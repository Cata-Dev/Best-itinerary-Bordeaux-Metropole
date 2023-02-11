import { Model } from "mongoose";
import { EndpointName, ProviderSchema } from ".";
import { logger } from "../logger";

export class Endpoint<N extends EndpointName> {
  private _fetchPromise: Promise<boolean> | null = null;
  /** Timestamp of last fetch (succeed or failed) */
  public lastFetch: number;

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
    public readonly model: Model<ProviderSchema<N>>,
  ) {
    this.lastFetch = 0;
  }

  get onCooldown(): boolean {
    return Date.now() - this.lastFetch < this.rate * 1000;
  }

  get fetching(): boolean {
    return !!this._fetchPromise;
  }

  get fetchPromise(): Promise<unknown> {
    if (this.fetching) return this._fetchPromise as Promise<boolean>;
    return new Promise((_, rej) => {
      rej(`No ongoing fetch for ${this.name}.`);
    });
  }

  async fetch(force = false, debug = false): Promise<boolean> {
    if (this.fetching) throw new Error(`Fetch is ongoing`);
    if (!force && this.onCooldown) throw new Error(`Fetch is on cooldown`);

    if (debug) logger.warn(`Refreshing ${this.name}...`);
    /**
     * @type {Promise}
     */
    this._fetchPromise = new Promise((resolve, reject) => {
      this._fetch()
        .then((r) => {
          this.lastFetch = Date.now();
          resolve(r);
        })
        .catch((e) => {
          if (debug) logger.error(`Fetch failed for ${this.name}`, e);
          reject(e);
        })
        .finally(() => {
          this._fetchPromise = null;
          if (debug) logger.info(`Refreshed ${this.name}.`);
        });
    });

    return this.fetchPromise as Promise<boolean>;
  }
}
