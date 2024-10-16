import { Type, getValidator, defaultAppConfiguration } from "@feathersjs/typebox";
import type { Static } from "@feathersjs/typebox";

import { dataValidator } from "./validators";

export const configurationSchema = Type.Intersect([
  defaultAppConfiguration,
  Type.Object({
    server: Type.Object({
      host: Type.String(),
      port: Type.Number(),
      TBMkey: Type.String(),
      SNCFkey: Type.String(),
      origins: Type.Array(Type.String()),
    }),
    dbAddress: Type.String(),
    sourceDB: Type.String(),
    computeDB: Type.String(),
    debug: Type.Optional(Type.Boolean()),
  }),
]);

export type ApplicationConfiguration = Static<typeof configurationSchema>;

export const configurationValidator = getValidator(configurationSchema, dataValidator);
