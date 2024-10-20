import { EndpointName, ProviderModel } from ".";
import { logger } from "../logger";
import { Deferred } from "common/async";
import { TypedEventEmitter } from "../utils/TypedEmitter";

interface EndpointEvents {
  fetch: () => void;
  fetched: (success: boolean) => void;
}

export class Endpoint<N extends EndpointName> extends TypedEventEmitter<
  EndpointEvents,
  keyof EndpointEvents
> {
  private deferredFetch: Deferred<boolean>;
  private _fetching = false;
  /** Timestamp of last fetch (succeed or failed) */
  private _lastFetch = 0;

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
    this.deferredFetch = new Deferred<boolean>();
    this.deferredFetch.resolve(false); // Initialization
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

  public async fetch(force = false, debug = false): Promise<boolean> {
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
      this._fetching = false;

      if (result) this.deferredFetch.resolve(true);
      else this.deferredFetch.reject(false);

      super.emit("fetched", result);
    }

    return this.deferredFetch.promise;
  }
}
