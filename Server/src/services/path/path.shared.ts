// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from "@feathersjs/feathers";
import type { ClientApplication } from "../../client";
import type { Path, PathData, PathPatch, PathQuery, PathService } from "./path.class";

export type { Path, PathData, PathPatch, PathQuery };

export type PathClientService = Pick<PathService<Params<PathQuery>>, (typeof pathMethods)[number]>;

export const pathPath = "path";

export const pathMethods: (keyof PathService)[] = ["get"];

export const pathClient = (client: ClientApplication) => {
  const connection = client.get("connection");

  client.use(pathPath, connection.service(pathPath), {
    methods: pathMethods,
  });
};

// Add this service to the client service type index
declare module "../../client" {
  interface ServiceTypes {
    [pathPath]: PathClientService;
  }
}
