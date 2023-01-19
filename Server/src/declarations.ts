/* eslint-disable @typescript-eslint/no-empty-interface */
import { HookContext as FeathersHookContext, NextFunction } from "@feathersjs/feathers";
import { Application as FeathersApplication } from "@feathersjs/koa";
import { ApplicationConfiguration } from "./configuration";

export { NextFunction };

export interface Configuration extends ApplicationConfiguration {}

// A mapping of service names to types. Will be extended in service files.
export interface ServiceTypes {}

// A mapping of application utils. Will be extended in utils parts.
export interface ExternalAPIs {}

// The application instance type that will be used everywhere else
export type Application = FeathersApplication<ServiceTypes, Configuration> & {
  externalAPIs: ExternalAPIs;
};

// The context for hook functions - can be typed with a service class
export type HookContext<S = unknown> = FeathersHookContext<Application, S>;
