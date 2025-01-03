// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from "@feathersjs/feathers";
import type { ClientApplication } from "../../client";
import type {
  RefreshData,
  RefreshDataData,
  RefreshDataPatch,
  RefreshDataQuery,
  RefreshDataService,
} from "./refresh-data.class";

export type { RefreshData, RefreshDataData, RefreshDataPatch, RefreshDataQuery };

export type RefreshDataClientService = Pick<
  RefreshDataService<Params<RefreshDataQuery>>,
  (typeof refreshDataMethods)[number]
>;

export const refreshDataPath = "refresh-data";

export const refreshDataMethods: (keyof RefreshDataService)[] = ["get"];

export const refreshDataClient = (client: ClientApplication) => {
  const connection = client.get("connection");

  client.use(refreshDataPath, connection.service(refreshDataPath), {
    methods: refreshDataMethods,
  });
};

// Add this service to the client service type index
declare module "../../client" {
  interface ServiceTypes {
    [refreshDataPath]: RefreshDataClientService;
  }
}
