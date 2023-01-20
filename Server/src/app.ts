import { feathers } from "@feathersjs/feathers";
import configuration from "@feathersjs/configuration";
import { koa, rest, bodyParser, errorHandler, parseAuthentication, cors } from "@feathersjs/koa";
import socketio from "@feathersjs/socketio";

import type { Application, HookContext, NextFunction } from "./declarations";
import { configurationValidator } from "./configuration";
import { errorHandler as errorHandlerHook, log } from "./hooks";
import { services } from "./services";
import { channels } from "./channels";
import { setupExternalAPIs } from "./externalAPIs/index";
import { logErrorHook } from "./logger";
import { setupMongoose, teardownMongoose } from "./mongoose";

const app: Application = koa(feathers()) as Application;

// Load our app configuration (see config/ folder)
app.configure(configuration(configurationValidator));

// Set up Koa middleware
app.use(cors());
app.use(errorHandler());
app.use(parseAuthentication());
app.use(bodyParser());

// Configure services and transports
app.configure(rest());
app.configure(
  socketio({
    cors: {
      origin: app.get("origins"),
    },
  }),
);
app.configure(services);
app.configure(channels);

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
      await setupExternalAPIs(context.app);
      await next();
    },
  ],
  teardown: [teardownMongoose],
});

export { app };
