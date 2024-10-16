// tbm_schedules-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import {
  addModelToTypegoose,
  buildSchema,
  deleteModelWithClass,
  getDiscriminatorModelForClass,
  getModelWithString,
  prop,
  Ref,
  ReturnModelType,
} from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { getName } from "@typegoose/typegoose/lib/internal/utils";
import { Connection } from "mongoose";
export function approachedStopName(_id: number) {
  return `as=${_id}` as const;
}

export function dbIntersectionId(_id: number) {
  return `i=${_id}` as const;
}

export function dbSectionId(_id: number) {
  return `s=${_id}` as const;
}

@modelOptions({ options: { customName: "FootGraph" } })
export class dbFootGraph {
  @prop({ required: true, type: () => String })
  public _id!:
    | ReturnType<typeof approachedStopName>
    | ReturnType<typeof dbIntersectionId>
    | ReturnType<typeof dbSectionId>;
}

@modelOptions({ options: { customName: "FootGraphNode" } })
export class dbFootGraphNodes extends dbFootGraph {
  @prop({ required: true, type: () => String })
  public _id!: ReturnType<typeof approachedStopName> | ReturnType<typeof dbIntersectionId>;

  @prop({ required: true, type: () => [Number] })
  public coords!: [number, number];

  @prop()
  public stopId?: number;
}

@modelOptions({ options: { customName: "FootGraphEdge" } })
export class dbFootGraphEdges extends dbFootGraph {
  @prop({ required: true, type: () => String })
  public _id!: ReturnType<typeof dbSectionId>;

  @prop({ required: true })
  public distance!: number;

  @prop({ required: true, type: () => [[Number, Number]] })
  public coords!: [number, number][];

  @prop({ required: true, ref: () => dbFootGraphNodes, type: () => [String, String] })
  public ends!: [
    Ref<dbFootGraphNodes, dbFootGraphNodes["_id"]>,
    Ref<dbFootGraphNodes, dbFootGraphNodes["_id"]>,
  ];
}

export default function init(
  db: Connection,
): readonly [
  ReturnModelType<typeof dbFootGraph>,
  ReturnModelType<typeof dbFootGraphNodes>,
  ReturnModelType<typeof dbFootGraphEdges>,
] {
  if (getModelWithString(getName(dbFootGraph))) deleteModelWithClass(dbFootGraph);
  if (getModelWithString(getName(dbFootGraphNodes))) deleteModelWithClass(dbFootGraphNodes);
  if (getModelWithString(getName(dbFootGraphEdges))) deleteModelWithClass(dbFootGraphEdges);

  const dbFootGraphSchema = buildSchema(dbFootGraph, { existingConnection: db });
  const dbFootGraphModelRaw = db.model(getName(dbFootGraph), dbFootGraphSchema);

  const dbFootGraphModel = addModelToTypegoose(dbFootGraphModelRaw, dbFootGraph, {
    existingConnection: db,
  });

  return [
    dbFootGraphModel,
    getDiscriminatorModelForClass(dbFootGraphModel, dbFootGraphNodes),
    getDiscriminatorModelForClass(dbFootGraphModel, dbFootGraphEdges),
  ] as const;
}

export type dbFootGraphModel = ReturnType<typeof init>[0];
export type dbFootGraphNodesModel = ReturnType<typeof init>[1];
export type dbFootGraphEdgesModel = ReturnType<typeof init>[2];
