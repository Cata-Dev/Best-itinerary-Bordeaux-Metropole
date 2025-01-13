// sncf_stops-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { type ReturnModelType, deleteModelWithClass, getModelForClass, prop } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { Coords } from "common/geographics";
import { Connection } from "mongoose";
import { SNCFEndpoints } from ".";

@modelOptions({ options: { customName: SNCFEndpoints.Stops } })
export class dbSNCF_Stops extends TimeStamps {
  @prop({ required: true })
  public _id!: number;

  @prop({ type: () => [Number, Number], required: true })
  public coords!: Coords;

  @prop({ required: true })
  public name!: string;

  @prop({ required: true })
  public name_norm!: string;
}

export default function init(db: Connection): ReturnModelType<typeof dbSNCF_Stops> {
  if (getModelForClass(dbSNCF_Stops, { existingConnection: db })) deleteModelWithClass(dbSNCF_Stops);

  return getModelForClass(dbSNCF_Stops, { existingConnection: db });
}

export type dbSNCF_StopsModel = ReturnType<typeof init>;
