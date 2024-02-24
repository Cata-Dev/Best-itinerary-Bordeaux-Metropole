// intersections-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { TBMEndpoints } from "./names";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { type ReturnModelType, addModelToTypegoose, buildSchema, deleteModelWithClass, getModelForClass, prop } from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { getName } from "@typegoose/typegoose/lib/internal/utils";
import { Connection } from "mongoose";

@modelOptions({ options: { customName: TBMEndpoints.Intersections } })
export class dbIntersections extends TimeStamps {
  @prop({ required: true })
  public _id!: number;

  @prop({ type: () => [Number, Number], required: true })
  public coords!: [number, number];

  @prop({ required: true })
  public nature!: string;
}

export default function init(db: Connection): ReturnModelType<typeof dbIntersections> {
  if (getModelForClass(dbIntersections, { existingConnection: db })) deleteModelWithClass(dbIntersections);

  const dbIntersectionsSchema = buildSchema(dbIntersections, { existingConnection: db });
  const dbIntersectionsModelRaw = db.model(getName(dbIntersections), dbIntersectionsSchema);

  return addModelToTypegoose(dbIntersectionsModelRaw, dbIntersections, {
    existingConnection: db,
  });
}

export type dbIntersectionsModel = ReturnType<typeof init>;
