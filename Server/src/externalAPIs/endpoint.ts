import { Deferred } from "@bibm/common/async";
import { ReturnModelType } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { EndpointName, ProviderModel } from ".";
import { Application } from "../declarations";
import { logger } from "../logger";
import { TypedEventEmitter } from "../utils/TypedEmitter";

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type EndpointEvents = {
  fetch: () => void;
  fetched: (success: boolean) => void;
};

declare class _ extends TimeStamps {}

function hasUpdatedAt(doc: unknown): doc is { updatedAt: Date } {
  return typeof doc === "object" && doc !== null && "updatedAt" in doc && doc.updatedAt instanceof Date;
}

type Hook<N extends EndpointName> = (endpointName: N) => Promise<void> | void;
type HookConstructor<N extends EndpointName> = (endpoint: Endpoint<N>) => Hook<N>;

async function runHook<N extends EndpointName>(hook: Hook<N>, endpointName: N) {
  try {
    await hook(endpointName);
  } catch (err) {
    logger.warn(`Error during fetched hook execution "${hook.name || "anonymous"}"`, err);
  }
}

function shouldDefer<N extends EndpointName>(
  app: Application,
  concurrentEndpoints: EndpointName[],
  candidateEndpoint: N,
) {
  return concurrentEndpoints.find((e) => e != candidateEndpoint && app.externalAPIs.endpoints[e].fetching);
}

/**
 * Make a concurrent hook, i.e. a hook that executes when no other Endpoint that registered is fetching
 * @param hook The actual hook function to be awaited
 * @returns A register function to apply this hook to an Endpoint
 */
function makeConcurrentHook<NS extends EndpointName>(
  hook: (app: Application, ...params: Parameters<Hook<NS>>) => ReturnType<Hook<NS>>,
) {
  const concurrentEndpoints: NS[] = [];
  let deferred = false;

  return <N extends NS>(app: Application, registeringEndpoint: N): HookConstructor<N> => {
    concurrentEndpoints.push(registeringEndpoint);

    const artificialHook = (endpointName: N) => {
      if (shouldDefer(app, concurrentEndpoints, endpointName)) {
        deferred = true;
        return;
      }

      deferred = false;
      return hook(app, endpointName);
    };

    return (endpoint) => {
      endpoint.on("fetched", (result) => {
        if (result === true) return;

        // Fetch failed
        if (deferred && !shouldDefer(app, concurrentEndpoints, registeringEndpoint)) {
          // (deferred === true <=> one concurrent endpoint fetch succeeded)
          // But if it was the last running, run anyway
          deferred = false;
          void runHook(artificialHook, registeringEndpoint);
        }
      });

      return artificialHook;
    };
  };
}

/**
 * Construct hook running hooks in parallel
 * @param hooks Hooks to run in parallel
 */
function parallelHooks<N extends EndpointName>(...hooks: Hook<N>[]): Hook<N> {
  return async (endpoint) => {
    await Promise.all(hooks.map((hook) => runHook(hook, endpoint)));
  };
}

/**
 * Construct hook running hooks in parallel
 * @param hooks Hooks to run in parallel
 */
function parallelHooksConstructor<N extends EndpointName>(
  ...hooks: HookConstructor<N>[]
): HookConstructor<N> {
  return (constructorEndpoint) => {
    return parallelHooks(...hooks.map((hook) => hook(constructorEndpoint)));
  };
}
/**
 * Construct hook sequentially running hooks
 * @param hooks Hooks to run sequentially, in the given order
 */
function sequenceHooksConstructor<N extends EndpointName>(
  ...hooks: HookConstructor<N>[]
): HookConstructor<N> {
  return (constructorEndpoint) => {
    const constructedHooks = hooks.map((hook) => hook(constructorEndpoint));
    return async (endpoint) => {
      for (const hook of constructedHooks) await runHook(hook, endpoint);
    };
  };
}

class Endpoint<N extends EndpointName> extends TypedEventEmitter<EndpointEvents> {
  private readonly deferredInit = new Deferred<this>();
  private deferredFetch = new Deferred<boolean>();
  private _fetching = false;
  /** Timestamp of last succeeded fetch */
  private _lastFetch = 0;
  private readonly hooks: Hook<N>[] = [];

  /**
   * Create a new Endpoint
   * @param name Endpoint's name
   * @param rate Endpoint's allowed time in seconds between two fetches
   * @param fetch Endpoint's fetch function
   * @param model Database model of the linked Mongoose collection
   */
  constructor(
    public readonly name: N,
    public readonly rate: number,
    private _fetch: () => Promise<boolean>,
    public readonly model: ProviderModel<N>,
  ) {
    super();
    // Retrieve last update time
    // Unsafe...
    (this.model as unknown as ReturnModelType<typeof _>)
      .findOne({}, { updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .exec()
      .then((lastUpdatedDoc) => {
        if (lastUpdatedDoc && hasUpdatedAt(lastUpdatedDoc))
          this._lastFetch = lastUpdatedDoc.updatedAt.getTime();
      })
      .catch((err) => logger.error(err))
      .finally(() => {
        this.deferredFetch.resolve(false); // Initialization
        this.deferredInit.resolve(this);
      });
  }

  public init() {
    return this.deferredInit.promise;
  }

  public get onCooldown(): boolean {
    return Date.now() - this._lastFetch < this.rate * 1000;
  }

  public get fetching() {
    return this._fetching;
  }

  public get fetchPromise() {
    return this.deferredFetch.promise;
  }

  public get lastFetch() {
    return this._lastFetch;
  }

  /**
   * Register hooks to run **after** having fetched.
   * They are run in parallel.
   * Those hooks will be awaited before resolving fetching, but doesn't block for further fetches.
   * Therefore, if a hook execution lasts longer than the current Endpoint cooldown, their executions might overlap.
   */
  public registerHook(...hooks: HookConstructor<N>[]) {
    for (const hook of hooks) this.hooks.push(hook(this));
    return this;
  }

  public async fetch(force = false, debug = false): Promise<boolean> {
    // Should be done by user, but just in case...
    await this.init();

    if (this.fetching) throw new Error(`Fetch is ongoing`);
    if (!force && this.onCooldown) throw new Error(`Fetch is on cooldown`);

    if (debug) logger.warn(`Refreshing ${this.name}...`);
    this._fetching = true;
    super.emit("fetch");

    this.deferredFetch = new Deferred<boolean>();
    let result = false;
    try {
      const r = await this._fetch();

      if (debug) logger.info(`Refreshed ${this.name}.`);

      this._lastFetch = Date.now();
      result = r;
    } catch (e) {
      if (debug) logger.error(`Fetch failed for ${this.name}`, e);

      result = false;
    } finally {
      // Free the fetching lock, allowing to fetch again if possible
      this._fetching = false;

      if (result)
        // Run hooks
        await parallelHooks(...this.hooks)(this.name);

      if (result) this.deferredFetch.resolve(true);
      else this.deferredFetch.reject(`Fetch failed for ${this.name}`);

      super.emit("fetched", result);
    }

    return this.deferredFetch.promise;
  }
}

export { Endpoint, makeConcurrentHook, parallelHooks, parallelHooksConstructor, sequenceHooksConstructor };
