import { initDB } from "../utils/mongoose";

// Needed to solve "Reflect.getMetadata is not a function" error of typegoose
import "core-js/features/reflect";

import type { Journey, RAPTORRunSettings } from "raptor";
import SharedRAPTOR from "raptor/lib/shared";
import { FootPath } from "raptor/lib/Structures";
import { SharedRAPTORData } from "raptor/lib/SharedStructures";
import { defaultRAPTORRunSettings } from "data/lib/values/RAPTOR";
import ResultModelInit, {
  JourneyLabelType,
  LabelBase,
  dbComputeResult,
  routeId,
  stopId,
} from "data/lib/models/Compute/result.model";
import type { BaseApplication } from "../base";
import { withDefaults } from "../utils";
import type { JobFn } from ".";
import { DocumentType } from "@typegoose/typegoose";

declare module "." {
  interface Jobs {
    compute: (
      ps: stopId,
      pt: stopId,
      date: Date,
      settings: Partial<RAPTORRunSettings>,
    ) => DocumentType<dbComputeResult>["_id"];
  }
}

type DBJourney = LabelBase[];
function journeyDBFormatter(j: Journey<stopId, routeId>): DBJourney {
  return j.map<LabelBase>((label) => ({
    ...label,
    type: "transfer" in label ? JourneyLabelType.Foot : JourneyLabelType.Vehicle,
  }));
}

// Acts as a factory
export default function (data: Parameters<typeof SharedRAPTORData.makeFromInternalData>[0]) {
  let RAPTORData = SharedRAPTORData.makeFromInternalData(data);
  let RAPTORInstance = new SharedRAPTOR(RAPTORData);

  const updateData = (data: Parameters<typeof SharedRAPTORData.makeFromInternalData>[0]) => {
    RAPTORData = SharedRAPTORData.makeFromInternalData(data);
    RAPTORInstance = new SharedRAPTOR(RAPTORData);
  };

  const init = (async (app: BaseApplication) => {
    const dataDB = await initDB(app, app.config.mainDB);
    const resultModel = ResultModelInit(dataDB);

    return async ({ data: [ps, pt, departureDate, reqSettings] }) => {
      // Convert to para-specific data (pointers)
      const convertedPs = RAPTORData.stopPointerFromId(ps);
      if (!convertedPs) throw new Error(`Invalid ps ${ps}`);

      const convertedPt = RAPTORData.stopPointerFromId(pt);
      if (!convertedPt) throw new Error(`Invalid pt ${pt}`);

      const settings = withDefaults(reqSettings, defaultRAPTORRunSettings);

      RAPTORInstance.run(convertedPs, convertedPt, departureDate.getTime(), settings);
      const bestJourneys = RAPTORInstance.getBestJourneys(pt)
        .filter((j): j is Journey<stopId, routeId> => !!j)
        .map((j) =>
          j.map((l) => ({
            ...l,
            // Convert back pointers to stop ids
            ...("boardedAt" in l ? { boardedAt: RAPTORData.stops.get(l.boardedAt)!.id } : {}),
            ...("transfer" in l
              ? {
                  transfer: {
                    ...l.transfer,
                    to: RAPTORData.stops.get(l.transfer.to)!.id,
                  } satisfies FootPath<stopId>,
                }
              : {}),
          })),
        );

      if (!bestJourneys.length) throw new Error("No journey found");

      // Keep only fastest journey & shortest journey
      const fastestJourney = bestJourneys.at(-1)!;
      const shortestJourney = bestJourneys.reduce(
        (acc, v) => (acc.length < v.length ? acc : v),
        bestJourneys[0],
      );

      const { _id } = await resultModel.create({
        from: ps,
        to: pt,
        journeys: [fastestJourney, shortestJourney].map((j) => journeyDBFormatter(j)),
        settings,
      } satisfies dbComputeResult);

      return _id;
    };
  }) satisfies JobFn<"compute">;

  return { init, updateData };
}
