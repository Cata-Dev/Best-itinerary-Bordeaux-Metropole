/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
// ComputeResult-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

export enum Providers {
  TBM,
  SNCF,
}

type StopId = dbTBM_Stops["_id"] | dbSNCF_Stops["_id"];

export function approachedStopName<Id extends StopId>(provider: Providers, _id: Id) {
  return `as=${provider}-${_id}` as const;
}

export type PathStep =
  | dbSections["rg_fv_graph_nd"]
  | dbSections["rg_fv_graph_na"]
  | ReturnType<typeof approachedStopName>;

import { Coords } from "@bibm/common/geographics";
import { deleteModelWithClass, getModelForClass, index, prop, Ref } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { Connection } from "mongoose";
import { dbSNCF_Stops } from "../SNCF/SNCF_stops.model";
import { dbSections } from "../TBM/sections.model";
import { dbTBM_Stops } from "../TBM/TBM_stops.model";

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
