// sncf_schedules-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { SNCFEndpoints } from "../index";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { addModelToTypegoose, buildSchema, prop, Ref } from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { getName } from "@typegoose/typegoose/lib/internal/utils";
import { dbSNCF_Stops } from "./SNCF_stops.model";

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

export default function init(app: Application) {
  const mongooseClient = app.get("mongooseClient");

  const dbSNCF_SchedulesSchema = buildSchema(dbSNCF_Schedules, { existingConnection: mongooseClient });
  const dbSNCF_SchedulesModelRaw = mongooseClient.model(getName(dbSNCF_Schedules), dbSNCF_SchedulesSchema);

  return addModelToTypegoose(dbSNCF_SchedulesModelRaw, dbSNCF_Schedules, {
    existingConnection: mongooseClient,
  });
}

export type dbSNCF_SchedulesModel = ReturnType<typeof init>;
