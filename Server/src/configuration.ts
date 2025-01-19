import { configurationSchema as packageConfig } from "@bibm/data/config/index";
import { Type, getValidator, defaultAppConfiguration } from "@feathersjs/typebox";
import type { Static } from "@feathersjs/typebox";

import { dataValidator } from "./validators";

const configurationSchema = Type.Intersect([defaultAppConfiguration, packageConfig]);

export type ApplicationConfiguration = Static<typeof configurationSchema>;

export const configurationValidator = getValidator(configurationSchema, dataValidator);
