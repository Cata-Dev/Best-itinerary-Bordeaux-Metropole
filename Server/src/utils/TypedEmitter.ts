import { EventEmitter } from "events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmittedEvents<T extends string | number | symbol> = Record<T, (...args: any) => any>;

export declare interface TypedEventEmitter<Events extends EmittedEvents<N>, N extends string> {
  on<E extends N>(event: E, listener: Events[E]): this;

  emit<E extends N>(event: E, ...args: Parameters<Events[E]>): boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-declaration-merging
export class TypedEventEmitter<Events extends EmittedEvents<N>, N extends string> extends EventEmitter {}
