// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html
import type { Params } from "@feathersjs/feathers";
import type { ClientApplication } from "../../client";
import type { Journey, JourneyData, JourneyPatch, JourneyQuery, JourneyService } from "./journey.class";

export type { Journey, JourneyData, JourneyPatch, JourneyQuery };

export type JourneyClientService = Pick<
  JourneyService<Params<JourneyQuery>>,
  (typeof journeyMethods)[number]
>;

export const journeyPath = "journey";

export const journeyMethods: (keyof JourneyService)[] = ["find", "get"];

export const journeyClient = (client: ClientApplication) => {
  const connection = client.get("connection");

  client.use(journeyPath, connection.service(journeyPath), {
    methods: journeyMethods,
  });
};

// Add this service to the client service type index
declare module "../../client" {
  interface ServiceTypes {
    [journeyPath]: JourneyClientService;
  }
}
