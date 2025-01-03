// intersections-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import {
  addModelToTypegoose,
  buildSchema,
  deleteModelWithClass,
  getModelForClass,
  prop,
  type ReturnModelType,
} from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { getName } from "@typegoose/typegoose/lib/internal/utils";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { Connection } from "mongoose";
import { TBMEndpoints } from ".";

@modelOptions({ options: { customName: TBMEndpoints.Intersections } })
export class dbIntersections extends TimeStamps {
  @prop({ required: true })
  public _id!: number;

  @prop({ type: () => [Number, Number], required: true })
  public coords!: [number, number];

  @prop({ required: true })
  public nature!: string;

  /** Not used for now
  @prop({ required: true })
  public commune!: string;

  @prop({ required: true })
  public code_commune!: string;
  */
}

export default function init(db: Connection): ReturnModelType<typeof dbIntersections> {
  if (getModelForClass(dbIntersections, { existingConnection: db })) deleteModelWithClass(dbIntersections);

  const dbSectionsSchema = buildSchema(dbIntersections, { existingConnection: db });
  const dbSectionsModelRaw = db.model(getName(dbIntersections), dbSectionsSchema);

  return addModelToTypegoose(dbSectionsModelRaw, dbIntersections, { existingConnection: db });
}

export type dbIntersectionsModel = ReturnType<typeof init>;
