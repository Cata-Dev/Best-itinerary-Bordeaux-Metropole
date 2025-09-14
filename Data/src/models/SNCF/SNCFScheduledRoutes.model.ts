// SNCFScheduledRoutes-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import {
  deleteModelWithClass,
  getModelForClass,
  prop,
  type Ref,
  type ReturnModelType,
} from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { Connection } from "mongoose";
import { SNCFEndpoints } from ".";
import SNCFSchedulesInit, { dbSNCF_Schedules } from "./SNCF_schedules.model";
import SNCFStopsInit, { dbSNCF_Stops } from "./SNCF_stops.model";

@modelOptions({ schemaOptions: { _id: false } })
export class TripOfScheduledRoute {
  @prop({ required: true })
  public tripId!: number;

  @prop({ required: true, ref: () => dbSNCF_Schedules, type: () => String })
  public schedules!: Ref<dbSNCF_Schedules>[];
}

@modelOptions({ options: { customName: SNCFEndpoints.ScheduledRoutes } })
export class dbSNCF_ScheduledRoutes extends TimeStamps {
  @prop({ required: true })
  public _id!: string;

  @prop({ required: true, type: () => TripOfScheduledRoute })
  public trips!: TripOfScheduledRoute[];

  @prop({ required: true, ref: () => dbSNCF_Stops, type: () => Number })
  public stops!: Ref<dbSNCF_Stops>[];
}

export default function init(db: Connection): ReturnModelType<typeof dbSNCF_ScheduledRoutes> {
  SNCFStopsInit(db);
  SNCFSchedulesInit(db);

  if (getModelForClass(dbSNCF_ScheduledRoutes, { existingConnection: db }))
    deleteModelWithClass(dbSNCF_ScheduledRoutes);

  return getModelForClass(dbSNCF_ScheduledRoutes, {
    existingConnection: db,
  });
}

export type dbSNCF_ScheduledRoutesModel = ReturnType<typeof init>;
