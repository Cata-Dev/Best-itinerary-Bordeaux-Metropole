import { Static, TSchema, Type } from "@feathersjs/typebox";

function defaultOptional<T extends TSchema>(schema: T) {
  return Type.Unsafe<Static<T>>(Type.Optional(schema));
}

export { defaultOptional };
