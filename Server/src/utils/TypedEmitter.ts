import { EventEmitter } from "events";

export declare interface TypedEventEmitter<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Events extends Record<string | number | symbol, (...args: any) => any>,
> {
  on<E extends keyof Events>(event: E, listener: Events[E]): this;

  emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TypedEventEmitter<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  Events extends Record<string | number | symbol, (...args: any) => any>,
> extends EventEmitter {}
