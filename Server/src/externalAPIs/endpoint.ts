import { Model } from "mongoose";
import { EndpointName, ProviderSchema } from ".";
import { logger } from "../logger";

export class Endpoint<N extends EndpointName> {
  /** Name of the endpoint */
  public readonly name: N;
  /** Allowed time in seconds between two fetches */
  public readonly rate: number;
  private _fetch: () => Promise<boolean>;
  private _fetchPromise: Promise<boolean> | null = null;
  /** Timestamp of last fetch (succeed or failed) */
  public lastFetch: number;
  /** Model of the linked Mongoose collection */
  public readonly model: Model<ProviderSchema<N>>;

  /**
   * Create a new Endpoint
   * @param name Endpoint's name
   * @param rate Endpoint's rate of fetch, in seconds
   * @param fetch Endpoint's fetch function
   * @param model Database model
   */
  constructor(name: N, rate: number, fetch: () => Promise<boolean>, model: Model<ProviderSchema<N>>) {
    this.name = name;
    this.rate = rate;
    this.lastFetch = 0;
    this._fetch = fetch;
    this.model = model;
  }

  get onCooldown() {
    return Date.now() - this.lastFetch < this.rate * 1000;
  }

  /**
   * @type {Boolean}
   */
  get fetching() {
    return !!this._fetchPromise;
  }

  /**
   * @type {Promise}
   */
  get fetchPromise() {
    if (this.fetching) return this._fetchPromise;
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
