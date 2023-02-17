// intersections-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { TBMEndpoints } from "../index";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { addModelToTypegoose, buildSchema, prop } from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { getName } from "@typegoose/typegoose/lib/internal/utils";

@modelOptions({ options: { customName: TBMEndpoints.Intersections } })
export class dbIntersections extends TimeStamps {
  @prop({ required: true })
  public _id!: number;

  @prop({ type: () => [Number, Number], required: true })
  public coords!: [number, number];

  @prop({ required: true })
  public nature!: string;
}

export default function init(app: Application) {
  const mongooseClient = app.get("mongooseClient");

  const dbIntersectionsSchema = buildSchema(dbIntersections, { existingConnection: mongooseClient });
  const dbIntersectionsModelRaw = mongooseClient.model(getName(dbIntersections), dbIntersectionsSchema);

  return addModelToTypegoose(dbIntersectionsModelRaw, dbIntersections, {
    existingConnection: mongooseClient,
  });
}

export type dbIntersectionsModel = ReturnType<typeof init>;
