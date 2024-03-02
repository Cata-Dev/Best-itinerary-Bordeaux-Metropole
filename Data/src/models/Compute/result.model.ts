// ComputeResult-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
export enum JourneyLabelType {
  Foot = "F",
  Vehicle = "V",
}

import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { addModelToTypegoose, buildSchema, deleteModelWithClass, getModelForClass, prop, type Ref, type ReturnModelType } from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { getName } from "@typegoose/typegoose/lib/internal/utils";
import { Connection } from "mongoose";
import { dbFootPaths } from "../TBM/NonScheduledRoutes.model";
import { dbTBM_ScheduledRoutes } from "../TBM/TBMScheduledRoutes.model";
import { RAPTORRunSettings } from "raptor";
import { dbTBM_Stops } from "../TBM/TBM_stops.model";

export type stopId = dbTBM_Stops["_id"];
export type routeId = dbTBM_ScheduledRoutes["_id"];

@modelOptions({
  schemaOptions: {
    _id: false,
  },
})
class RunSettings implements RAPTORRunSettings {
  @prop({ required: true })
  public walkSpeed!: number;
}

@modelOptions({
  schemaOptions: {
    discriminatorKey: "type",
    _id: false,
  },
})
export class LabelBase {
  @prop({ required: true })
  /** @description Label type */
  public type!: JourneyLabelType;

  @prop({ required: true })
  public time!: number;
}

class LabelFoot extends LabelBase {
  @prop({ required: true })
  public boardedAt!: stopId;

  @prop({ required: true, ref: () => dbFootPaths })
  public transfer!: Ref<dbFootPaths>;
}

class LabelVehicle extends LabelBase {
  @prop({ required: true })
  public boardedAt!: stopId;

  @prop({ required: true, ref: () => dbTBM_ScheduledRoutes, type: () => Number })
  public route!: Ref<dbTBM_ScheduledRoutes>;

  @prop({ required: true })
  public tripIndex!: number;
}

@modelOptions({ options: { customName: "results" } })
export class dbComputeResult extends TimeStamps {
  @prop({ required: true, ref: () => dbTBM_Stops, type: () => Number })
  public from!: Ref<dbTBM_Stops>;

  @prop({ required: true, ref: () => dbTBM_Stops, type: () => Number })
  public to!: Ref<dbTBM_Stops>;

  @prop({ required: true, type: () => RunSettings })
  settings!: RunSettings;

  @prop({
    required: true,
    type: [[LabelBase]],
    discriminators: () => [
      { type: LabelFoot, value: JourneyLabelType.Foot },
      { type: LabelVehicle, value: JourneyLabelType.Vehicle },
    ],
  })
  journeys!: LabelBase[][];
}

export default function init(db: Connection): ReturnModelType<typeof dbComputeResult> {
  if (getModelForClass(dbComputeResult, { existingConnection: db })) deleteModelWithClass(dbComputeResult);

  const dbComputeResultSchema = buildSchema(dbComputeResult, { existingConnection: db });
  const dbComputeResultModelRaw = db.model(getName(dbComputeResult), dbComputeResultSchema);

  return addModelToTypegoose(dbComputeResultModelRaw, dbComputeResult, {
    existingConnection: db,
  });
}

export type dbComputeResultModel = ReturnType<typeof init>;
