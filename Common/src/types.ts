import type { Ref } from "@typegoose/typegoose";
import type { RefType } from "@typegoose/typegoose/lib/types";

type KeyOfMap<M extends Map<unknown, unknown>> = M extends Map<infer K, unknown> ? K : never;

type Satisfy<B, T extends B> = T;

type UnpackRefType<T> =
  T extends Ref<infer D>
    ? D extends {
        _id?: RefType;
      }
      ? D["_id"]
      : never
    : T extends Ref<infer D>[]
      ? D extends {
          _id?: RefType;
        }
        ? D["_id"][]
        : never
      : never;

type PopulateRef<T> = T extends Ref<infer D> ? D : T extends Ref<infer D>[] ? D[] : never;

export { KeyOfMap, PopulateRef, Satisfy, UnpackRefType };
