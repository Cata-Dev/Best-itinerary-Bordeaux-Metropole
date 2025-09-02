// addresses-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { deleteModelWithClass, getModelForClass, prop, type ReturnModelType } from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { Connection } from "mongoose";
import { approachedStopName, PathStep } from "./GraphApproachedPoints.model";

@modelOptions({ options: { customName: "NonScheduledRoutes" } })
export class dbFootPaths {
  /** It's a ref to a stop, but might be TBM, SNCF... Depends on its name */
  @prop({ required: true, index: true, type: () => String })
  public from!: ReturnType<typeof approachedStopName>;

  /** It's a ref to a stop, but might be TBM, SNCF... Depends on its name */
  @prop({ required: true, index: true, type: () => String })
  public to!: ReturnType<typeof approachedStopName>;

  @prop({ required: true })
  public distance!: number;

  @prop()
  public path?: PathStep[]; // Ref[] to intersections | stops
}

export default function init(db: Connection): ReturnModelType<typeof dbFootPaths> {
  if (getModelForClass(dbFootPaths, { existingConnection: db })) deleteModelWithClass(dbFootPaths);

  return getModelForClass(dbFootPaths, { existingConnection: db });
}

export type dbFootPathsModel = ReturnType<typeof init>;
