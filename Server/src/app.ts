import compress from "compression";
import helmet from "helmet";
import cors from "cors";

import { feathers, NextFunction } from "@feathersjs/feathers";
import express, { rest, json, urlencoded, notFound, errorHandler } from "@feathersjs/express";
import configuration from "@feathersjs/configuration";
import socketio from "@feathersjs/socketio";

import type { Application, HookContext } from "./declarations";
import { configurationSchema } from "./configuration";
import { logErrorHook, logger } from "./logger";
import { log, errorHandler as errorHandlerHook } from "./hooks";
import { setupMongoose, teardownMongoose } from "./mongoose";
import { services } from "./services/index";
import { channels } from "./channels";
import { setupExternalAPIs } from "./externalAPIs";

const app: Application = express(feathers()) as Application;

// Load app configuration
app.configure(configuration(configurationSchema));
// Enable security, CORS, compression, favicon and body parsing
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(cors());
app.use(compress());
app.use(json());
app.use(urlencoded({ extended: true }));
// Set up Plugins and providers
app.configure(rest());
app.configure(socketio());
app.configure(services);
app.configure(channels);

app.use(notFound());
app.use(errorHandler({ logger }));

// app.configure(setupMongoose);

//Set up custom utils
// app.configure(setupExternalAPIs);

// Register hooks that run on all service methods
app.hooks({
  around: {
    all: [log, logErrorHook],
  },
  before: {},
  after: {},
  error: {
    all: [errorHandlerHook],
  },
});
// Register application setup and teardown hooks here
app.hooks({
  setup: [
    setupMongoose,
    async (context: HookContext, next: NextFunction) => {
      await setupExternalAPIs(context.self);
      await next();
    },
  ],
  teardown: [teardownMongoose],
});

export { app };
