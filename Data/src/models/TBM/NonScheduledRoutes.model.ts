// addresses-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import {
  addModelToTypegoose,
  buildSchema,
  deleteModelWithClass,
  getModelForClass,
  prop,
  type Ref,
  type ReturnModelType,
} from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { getName } from "@typegoose/typegoose/lib/internal/utils";
import { Connection } from "mongoose";
import { dbTBM_Stops } from "./TBM_stops.model";
import { dbFootGraphNodes } from "./FootGraph.model";

@modelOptions({ options: { customName: "NonScheduledRoutes" } })
export class dbFootPaths {
  @prop({ required: true, index: true, ref: () => dbTBM_Stops, type: () => Number })
  public from!: Ref<dbTBM_Stops, number>;

  @prop({ required: true, index: true, ref: () => dbTBM_Stops, type: () => Number })
  public to!: Ref<dbTBM_Stops, number>;

  @prop({ required: true })
  public distance!: number;

  @prop({ ref: () => dbFootGraphNodes, type: () => String })
  public path?: Ref<dbFootGraphNodes, dbFootGraphNodes["_id"]>[]; // Ref[] to intersections | stops
}

export default function init(db: Connection): ReturnModelType<typeof dbFootPaths> {
  if (getModelForClass(dbFootPaths, { existingConnection: db })) deleteModelWithClass(dbFootPaths);

  const dbFootPathsSchema = buildSchema(dbFootPaths, { existingConnection: db });
  const dbFootPathsModelRaw = db.model(getName(dbFootPaths), dbFootPathsSchema);

  return addModelToTypegoose(dbFootPathsModelRaw, dbFootPaths, { existingConnection: db });
}

export type dbFootPathsModel = ReturnType<typeof init>;
