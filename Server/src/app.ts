import { feathers } from "@feathersjs/feathers";

import { join, delimiter } from "path";
process.env.NODE_CONFIG_DIR = [
  join(__dirname, "../../../Data/config/"),
  join(__dirname, "../../config/"),
  // In ts-node
  join(__dirname, "../../Data/config/"),
  join(__dirname, "../config/"),
].join(delimiter);

import configuration from "@feathersjs/configuration";
import { koa, rest, bodyParser, errorHandler, parseAuthentication, cors } from "@feathersjs/koa";
import socketio from "@feathersjs/socketio";

import type { Application, HookContext, NextFunction } from "./declarations";
import { configurationValidator } from "./configuration";
import { errorHandler as errorHandlerHook, log } from "./hooks";

// Needed to solve Reflect import for typegoose
import "core-js/features/reflect";

import { services } from "./services";
import { channels } from "./channels";
import { setupExternalAPIs } from "./externalAPIs/index";
import { logErrorHook } from "./logger";
import { setupMongoose, teardownMongoose } from "./mongoose";
import { setupCompute, teardownCompute } from "./compute";

const app: Application = koa(feathers()) as Application;

// Load our app configuration (see config/ folder)
app.configure(configuration(configurationValidator));

// Set up Koa middleware
app.use(cors());
app.use(errorHandler());
app.use(parseAuthentication());
app.use(bodyParser());

// Configure transports
app.configure(rest());
app.configure(
  socketio({
    cors: {
      origin: app.get("server").origins,
    },
  }),
);

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
    setupCompute,
    async (context: HookContext, next: NextFunction) => {
      setupExternalAPIs(context.app);
      await next();
    },
    async (_: HookContext, next: NextFunction) => {
      // Configure services
      app.configure(services);
      app.configure(channels);
      await next();
    },
  ],
  teardown: [teardownMongoose, teardownCompute],
});

export { app };
