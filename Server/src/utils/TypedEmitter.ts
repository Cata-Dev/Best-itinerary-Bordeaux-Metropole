import { EventEmitter } from "events";

// @typescript-eslint/consistent-indexed-object-style
type EmittedEvents<T extends string | number | symbol> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k in T]: (...args: any) => any;
};

export declare interface TypedEventEmitter<Events extends EmittedEvents<N>, N extends string> {
  on<E extends N>(event: E, listener: Events[E]): this;

  emit<E extends N>(event: E, ...args: Parameters<Events[E]>): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-declaration-merging
export class TypedEventEmitter<Events extends EmittedEvents<N>, N extends string> extends EventEmitter {}
