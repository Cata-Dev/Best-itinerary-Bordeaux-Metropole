// Wrapper around typebox
import { getValidator, Static, Type } from "@feathersjs/typebox";
// Wrapper around json-schema-to-ts
import { Ajv } from "@feathersjs/schema";

import { join, delimiter } from "path";
process.env.NODE_CONFIG_DIR = [join(__dirname, "../../config/")].join(delimiter);

// Wrapper around node-config
import config from "config";

const configurationSchema = Type.Object({
  server: Type.Object({
    host: Type.String(),
    port: Type.Number(),
    TBMkey: Type.String(),
    SNCFkey: Type.String(),
    origins: Type.Array(Type.String()),
  }),
  compute: Type.Object({
    redis: Type.Object({
      host: Type.String(),
      port: Type.Number(),
    }),
    nbWorkers: Type.Optional(Type.Number()),
  }),
  dbAddress: Type.String(),
  sourceDB: Type.String(),
  computeDB: Type.String(),
  debug: Type.Optional(Type.Boolean()),
});

type Configuration = Static<typeof configurationSchema>;

const dataValidator = new Ajv({});
const configurationValidator = getValidator<Configuration>(configurationSchema, dataValidator);

const configObject = config.util.toObject() as Configuration;

configurationValidator(configObject).catch((err) => console.error("Configuration validation failed", err));

export { configurationSchema, configObject as config };
export type { Configuration };
