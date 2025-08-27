// ComputeResult-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Coords } from "@bibm/common/geographics";
import { deleteModelWithClass, getModelForClass, index, prop, Ref } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { Connection } from "mongoose";
import { PathStep } from "../TBM/NonScheduledRoutes.model";
import { dbSections } from "../TBM/sections.model";

@index({ s: 1, target: 1 }, { unique: true })
@index({ t: 1, target: 1 }, { unique: true })
export class GraphApproachedPoints extends TimeStamps {
  @prop({ required: true })
  public s!: PathStep;

  @prop({ required: true })
  public t!: PathStep;

  @prop({ required: true })
  public target!: PathStep;

  @prop({ required: true })
  public distanceToTarget!: number;

  @prop({ required: true })
  public distanceFromTarget!: number;

  @prop({ required: true, ref: () => dbSections, type: () => Number })
  public edge!: Ref<dbSections>;

  @prop({ required: true })
  public cutIdx!: number;

  @prop({ required: true, type: () => [Number, Number] })
  public approachedCoords!: Coords;

  @prop({ required: true })
  public type!: string;
}

export default function init(db: Connection) {
  if (getModelForClass(GraphApproachedPoints, { existingConnection: db }))
    deleteModelWithClass(GraphApproachedPoints);

  return getModelForClass(GraphApproachedPoints, {
    existingConnection: db,
  });
}

export type GraphApproachedPointsModel = ReturnType<typeof init>;
