// ComputeResult-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
export enum JourneyStepType {
  Base = "B",
  Foot = "F",
  Vehicle = "V",
}

export enum LocationType {
  SNCF = "S",
  TBM = "T",
  Address = "A",
}

import { deleteModelWithClass, getModelForClass, prop, type Ref } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { Connection } from "mongoose";
import { RAPTORRunSettings } from "raptor";
import { dbSNCF_Stops } from "../SNCF/SNCF_stops.model";
import { dbAddresses } from "../TBM/addresses.model";
import { dbTBM_Stops } from "../TBM/TBM_stops.model";
import { dbTBM_ScheduledRoutes } from "../TBM/TBMScheduledRoutes.model";

export type stopId = dbTBM_Stops["_id"];
export type routeId = dbTBM_ScheduledRoutes["_id"];

@modelOptions({
  schemaOptions: {
    _id: false,
  },
})
class RunSettings implements RAPTORRunSettings {
  @prop({ required: true })
  public maxTransferLength!: number;

  @prop({ required: true })
  public walkSpeed!: number;
}

@modelOptions({
  schemaOptions: {
    discriminatorKey: "type",
    _id: false,
  },
})
export class JourneyStepBase {
  @prop({ required: true })
  /** @description JourneyStep type */
  public type!: JourneyStepType;

  @prop({ required: true })
  public time!: number;
}

class Transfer {
  @prop({ required: true })
  public to!: stopId | string;

  @prop({ required: true })
  public length!: number;
}

export class JourneyStepFoot extends JourneyStepBase {
  @prop({ required: true })
  public boardedAt!: stopId | string;

  @prop({ required: true })
  public transfer!: Transfer;
}

export function isJourneyStepFoot(label: JourneyStepBase): label is JourneyStepFoot {
  return label.type === JourneyStepType.Foot;
}

export class JourneyStepVehicle extends JourneyStepBase {
  @prop({ required: true })
  public boardedAt!: stopId | string;

  @prop({ required: true, ref: () => dbTBM_ScheduledRoutes, type: () => Number })
  public route!: Ref<dbTBM_ScheduledRoutes>;

  @prop({ required: true })
  public tripIndex!: number;
}

export function isJourneyStepVehicle(js: JourneyStepBase): js is JourneyStepVehicle {
  return js.type === JourneyStepType.Vehicle;
}

export class Criterion {
  @prop({ required: true })
  public name!: string;

  @prop({ required: true })
  public value!: number;
}

export class Journey {
  @prop({
    required: true,
    type: [JourneyStepBase],
    discriminators: () => [
      { type: JourneyStepBase, value: JourneyStepType.Base },
      { type: JourneyStepFoot, value: JourneyStepType.Foot },
      { type: JourneyStepVehicle, value: JourneyStepType.Vehicle },
    ],
  })
  public steps!: JourneyStepBase[];

  @prop({ required: true })
  public criteria!: Criterion[];
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

  @prop({ required: true })
  departureTime!: Date;

  @prop({ required: true, type: () => RunSettings })
  settings!: RunSettings;

  @prop({ required: true })
  journeys!: Journey[];
}

export default function init(db: Connection) {
  if (getModelForClass(dbComputeResult, { existingConnection: db })) deleteModelWithClass(dbComputeResult);

  return getModelForClass(dbComputeResult, {
    existingConnection: db,
  });
}

export type dbComputeResultModel = ReturnType<typeof init>;
