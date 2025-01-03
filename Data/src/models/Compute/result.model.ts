// ComputeResult-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
export enum JourneyLabelType {
  Base = "B",
  Foot = "F",
  Vehicle = "V",
}

export enum LocationType {
  SNCF = "S",
  TBM = "T",
  Address = "A",
}

import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import {
  addModelToTypegoose,
  buildSchema,
  deleteModelWithClass,
  getModelForClass,
  prop,
  type Ref,
} from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { getName } from "@typegoose/typegoose/lib/internal/utils";
import { Connection } from "mongoose";
import { dbTBM_ScheduledRoutes } from "../TBM/TBMScheduledRoutes.model";
import { RAPTORRunSettings } from "raptor";
import { dbTBM_Stops } from "../TBM/TBM_stops.model";
import { dbSNCF_Stops } from "../SNCF/SNCF_stops.model";
import { dbAddresses } from "../TBM/addresses.model";

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

class transfer {
  @prop({ required: true })
  public to!: stopId | string;

  @prop({ required: true })
  public length!: number;
}

export class LabelFoot extends LabelBase {
  @prop({ required: true })
  public boardedAt!: stopId | string;

  @prop({ required: true })
  public transfer!: transfer;
}

export function isLabelFoot(label: LabelBase): label is LabelFoot {
  return label.type === JourneyLabelType.Foot;
}

export class LabelVehicle extends LabelBase {
  @prop({ required: true })
  public boardedAt!: stopId | string;

  @prop({ required: true, ref: () => dbTBM_ScheduledRoutes, type: () => Number })
  public route!: Ref<dbTBM_ScheduledRoutes>;

  @prop({ required: true })
  public tripIndex!: number;
}

export function isLabelVehicle(label: LabelBase): label is LabelVehicle {
  return label.type === JourneyLabelType.Vehicle;
}

@modelOptions({
  schemaOptions: {
    discriminatorKey: "type",
    _id: false,
  },
})
class LocationBase {
  @prop({ required: true })
  public type!: LocationType;
}

export class LocationSNCF extends LocationBase {
  @prop({ required: true, ref: () => dbSNCF_Stops, type: () => Number })
  public id!: Ref<dbSNCF_Stops>;
}
export function isLocationSNCF(loc: LocationBase): loc is LocationSNCF {
  return loc.type === LocationType.SNCF;
}

export class LocationTBM extends LocationBase {
  @prop({ required: true, ref: () => dbTBM_Stops, type: () => Number })
  public id!: Ref<dbTBM_Stops>;
}
export function isLocationTBM(loc: LocationBase): loc is LocationTBM {
  return loc.type === LocationType.TBM;
}

export class LocationAddress extends LocationBase {
  @prop({ required: true, ref: () => dbAddresses, type: () => Number })
  public id!: Ref<dbAddresses>;
}

export function isLocationAddress(loc: LocationBase): loc is LocationAddress {
  return loc.type === LocationType.Address;
}

@modelOptions({ options: { customName: "results" } })
export class dbComputeResult extends TimeStamps {
  @prop({
    required: true,
    type: LocationBase,
    discriminators: () => [
      { type: LocationSNCF, value: LocationType.SNCF },
      { type: LocationTBM, value: LocationType.TBM },
      { type: LocationAddress, value: LocationType.Address },
    ],
  })
  public from!: LocationBase;

  @prop({
    required: true,
    type: LocationBase,
    discriminators: () => [
      { type: LocationSNCF, value: LocationType.SNCF },
      { type: LocationTBM, value: LocationType.TBM },
      { type: LocationAddress, value: LocationType.Address },
    ],
  })
  public to!: LocationBase;

  @prop({ required: true, type: () => RunSettings })
  settings!: RunSettings;

  @prop({
    required: true,
    type: [[LabelBase]],
    discriminators: () => [
      { type: LabelBase, value: JourneyLabelType.Base },
      { type: LabelFoot, value: JourneyLabelType.Foot },
      { type: LabelVehicle, value: JourneyLabelType.Vehicle },
    ],
  })
  journeys!: LabelBase[][];
}

export default function init(db: Connection) {
  if (getModelForClass(dbComputeResult, { existingConnection: db })) deleteModelWithClass(dbComputeResult);

  const dbComputeResultSchema = buildSchema(dbComputeResult, { existingConnection: db });
  const dbComputeResultModelRaw = db.model(getName(dbComputeResult), dbComputeResultSchema);

  return addModelToTypegoose(dbComputeResultModelRaw, dbComputeResult, {
    existingConnection: db,
  });
}

export type dbComputeResultModel = ReturnType<typeof init>;
