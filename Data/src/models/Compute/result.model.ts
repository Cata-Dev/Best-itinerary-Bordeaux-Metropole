// ComputeResult-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html
export enum JourneyStepType {
  Base = "B",
  Foot = "F",
  Vehicle = "V",
}

import { deleteModelWithClass, getModelForClass, prop, type Ref } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { Connection } from "mongoose";
import { InternalTimeInt, RAPTORRunSettings } from "raptor";
import { dbSNCF_Stops } from "../SNCF/SNCF_stops.model";
import { dbSNCF_ScheduledRoutes } from "../SNCF/SNCFScheduledRoutes.model";
import { dbAddresses } from "../TBM/addresses.model";
import { dbTBM_Stops } from "../TBM/TBM_stops.model";
import { dbTBM_ScheduledRoutes } from "../TBM/TBMScheduledRoutes.model";

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
  public time!: InternalTimeInt;
}

export enum PointType {
  Address = "A",
  TBMStop = "T",
  SNCFStop = "S",
}

@modelOptions({
  schemaOptions: {
    discriminatorKey: "type",
    _id: false,
  },
})
export class PointBase {
  @prop({ required: true })
  public type!: PointType;
}

export class AddressPoint extends PointBase {
  @prop({ required: true, ref: () => dbAddresses, type: () => Number })
  public id!: Ref<dbAddresses>;
}

export function isPointAddress(point: PointBase): point is AddressPoint {
  return point.type === PointType.Address;
}

export class TBMStopPoint extends PointBase {
  @prop({ required: true, ref: () => dbTBM_Stops, type: () => Number })
  public id!: Ref<dbTBM_Stops>;
}

export function isPointTBMStop(point: PointBase): point is TBMStopPoint {
  return point.type === PointType.TBMStop;
}

export class SNCFStopPoint extends PointBase {
  @prop({ required: true, ref: () => dbSNCF_Stops, type: () => Number })
  public id!: Ref<dbSNCF_Stops>;
}

export function isPointSNCFStop(point: PointBase): point is SNCFStopPoint {
  return point.type === PointType.SNCFStop;
}

class Transfer {
  @prop({
    required: true,
    type: PointBase,
    discriminators: () => [
      { type: AddressPoint, value: PointType.Address },
      { type: TBMStopPoint, value: PointType.TBMStop },
      { type: SNCFStopPoint, value: PointType.SNCFStop },
    ],
  })
  public to!: PointBase;

  @prop({ required: true })
  public length!: number;
}

export class JourneyStepFoot extends JourneyStepBase {
  @prop({
    required: true,
    type: PointBase,
    discriminators: () => [
      { type: AddressPoint, value: PointType.Address },
      { type: TBMStopPoint, value: PointType.TBMStop },
      { type: SNCFStopPoint, value: PointType.SNCFStop },
    ],
  })
  public boardedAt!: PointBase;

  @prop({ required: true })
  public transfer!: Transfer;
}

export function isJourneyStepFoot(label: JourneyStepBase): label is JourneyStepFoot {
  return label.type === JourneyStepType.Foot;
}

export enum RouteType {
  TBM = "T",
  SNCF = "S",
}

@modelOptions({
  schemaOptions: {
    discriminatorKey: "type",
    _id: false,
  },
})
export class RouteBase {
  @prop({ required: true })
  public type!: RouteType;
}

export class TBMRoute extends RouteBase {
  @prop({ required: true, ref: () => dbAddresses, type: () => Number })
  public id!: Ref<dbTBM_ScheduledRoutes, number>;
}

export function isRouteTBM(route: RouteBase): route is TBMRoute {
  return route.type === RouteType.TBM;
}

export class SNCFRoute extends RouteBase {
  @prop({ required: true, ref: () => dbTBM_Stops, type: () => Number })
  public id!: Ref<dbSNCF_ScheduledRoutes>;
}

export function isRouteSNCF(route: RouteBase): route is SNCFRoute {
  return route.type === RouteType.SNCF;
}

export class JourneyStepVehicle extends JourneyStepBase {
  @prop({
    required: true,
    type: PointBase,
    discriminators: () => [
      { type: AddressPoint, value: PointType.Address },
      { type: TBMStopPoint, value: PointType.TBMStop },
      { type: SNCFStopPoint, value: PointType.SNCFStop },
    ],
  })
  public boardedAt!: PointBase;

  @prop({
    required: true,
    type: RouteBase,
    discriminators: () => [
      { type: TBMRoute, value: RouteType.TBM },
      { type: SNCFRoute, value: RouteType.SNCF },
    ],
  })
  public route!: RouteBase;

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
  public value!: unknown;
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
  public type!: PointType;
}

export class LocationSNCF extends LocationBase {
  @prop({ required: true, ref: () => dbSNCF_Stops, type: () => Number })
  public id!: Ref<dbSNCF_Stops>;
}
export function isLocationSNCF(loc: LocationBase): loc is LocationSNCF {
  return loc.type === PointType.SNCFStop;
}

export class LocationTBM extends LocationBase {
  @prop({ required: true, ref: () => dbTBM_Stops, type: () => Number })
  public id!: Ref<dbTBM_Stops>;
}
export function isLocationTBM(loc: LocationBase): loc is LocationTBM {
  return loc.type === PointType.TBMStop;
}

export class LocationAddress extends LocationBase {
  @prop({ required: true, ref: () => dbAddresses, type: () => Number })
  public id!: Ref<dbAddresses>;
}

export function isLocationAddress(loc: LocationBase): loc is LocationAddress {
  return loc.type === PointType.Address;
}

@modelOptions({ options: { customName: "results" } })
export class dbComputeResult extends TimeStamps {
  @prop({
    required: true,
    type: LocationBase,
    discriminators: () => [
      { type: LocationSNCF, value: PointType.SNCFStop },
      { type: LocationTBM, value: PointType.TBMStop },
      { type: LocationAddress, value: PointType.Address },
    ],
  })
  public from!: LocationBase;

  @prop({
    required: true,
    type: LocationBase,
    discriminators: () => [
      { type: LocationSNCF, value: PointType.SNCFStop },
      { type: LocationTBM, value: PointType.TBMStop },
      { type: LocationAddress, value: PointType.Address },
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
