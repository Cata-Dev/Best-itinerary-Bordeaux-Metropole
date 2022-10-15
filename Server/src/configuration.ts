import { schema, Ajv } from "@feathersjs/schema";
import type { Infer } from "@feathersjs/schema";

export const configurationSchema = schema(
  {
    $id: "ApplicationConfiguration",
    type: "object",
    additionalProperties: false,
    required: ["host", "port", "TBMkey", "SNCFkey", "mongodb", "ssl"],
    properties: {
      host: { type: "string" },
      port: { type: "number" },
      TBMkey: { type: "string" },
      SNCFkey: { type: "string" },
      mongodb: { type: "string" },
      ssl: {
        type: "object",
        additionalProperties: false,
        required: ["key", "cert"],
        properties: {
          key: { type: "string" },
          cert: { type: "string" },
        },
      },
      debug: { type: "boolean", default: false },
    },
  } as const,
  new Ajv(),
);

export type ConfigurationSchema = Infer<typeof configurationSchema>;
