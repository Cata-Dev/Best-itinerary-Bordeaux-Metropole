import { feathers } from "@feathersjs/feathers";

import { bodyParser, cors, errorHandler, koa, parseAuthentication, rest } from "@feathersjs/koa";
import socketio from "@feathersjs/socketio";

import { configurationValidator } from "./configuration";
import type { Application, HookContext, NextFunction } from "./declarations";
// Import after ../configuration which defines configuration path
import configuration from "@feathersjs/configuration";
import { errorHandler as errorHandlerHook, log } from "./hooks";

// Needed to solve Reflect import for typegoose
import "core-js/features/reflect";

import setupActions from "./actions";
import { channels } from "./channels";
import { setupCompute, teardownCompute } from "./compute";
import { setupExternalAPIs } from "./externalAPIs/index";
import { setupMongoose, teardownMongoose } from "./mongoose";
import { services } from "./services";

const app: Application = koa(feathers()) as Application;

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
    all: [log],
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
      const refresh = await setupExternalAPIs(context.app);

      await next();
      // Start refreshing after having registered everything
      void refresh();
    },
    async (_: HookContext, next: NextFunction) => {
      // Configure services
      app.configure(services);
      app.configure(channels);

      await next();
    },
    async (_: HookContext, next: NextFunction) => {
      setupActions();

      await next();
    },
  ],
  teardown: [teardownMongoose, teardownCompute],
});

export { app };
