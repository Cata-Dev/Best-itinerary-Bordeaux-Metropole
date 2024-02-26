// sncf_schedules-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { SNCFEndpoints } from "./names";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { addModelToTypegoose, buildSchema, deleteModelWithClass, getModelForClass, prop, type Ref, type ReturnModelType } from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { getName } from "@typegoose/typegoose/lib/internal/utils";
import { dbSNCF_Stops } from "./SNCF_stops.model";
import { Connection } from "mongoose";

@modelOptions({ options: { customName: SNCFEndpoints.Schedules } })
export class dbSNCF_Schedules extends TimeStamps {
  @prop({ required: true })
  public _id!: string;

  @prop({ required: true })
  public realtime!: Date;

  @prop({ required: true })
  public trip!: number; //iImplicitly includes direction

  @prop({ required: true, ref: () => dbSNCF_Stops, type: () => Number })
  public stop_point!: Ref<dbSNCF_Stops, number>;

  @prop({ required: true })
  public route!: string; // Should be a ref
}

export default function init(db: Connection): ReturnModelType<typeof dbSNCF_Schedules> {
  if (getModelForClass(dbSNCF_Schedules, { existingConnection: db })) deleteModelWithClass(dbSNCF_Schedules);

  const dbSNCF_SchedulesSchema = buildSchema(dbSNCF_Schedules, { existingConnection: db });
  const dbSNCF_SchedulesModelRaw = db.model(getName(dbSNCF_Schedules), dbSNCF_SchedulesSchema);

  return addModelToTypegoose(dbSNCF_SchedulesModelRaw, dbSNCF_Schedules, {
    existingConnection: db,
  });
}

export type dbSNCF_SchedulesModel = ReturnType<typeof init>;
