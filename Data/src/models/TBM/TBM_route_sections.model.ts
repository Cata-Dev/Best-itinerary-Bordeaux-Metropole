// tbm_vehicles-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Coords } from "@bibm/common/geographics";
import {
  deleteModelWithClass,
  getModelForClass,
  prop,
  type Ref,
  type ReturnModelType,
} from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { Connection } from "mongoose";
import { TBMEndpoints } from ".";
import { dbTBM_Stops, VehicleType } from "./TBM_stops.model";

@modelOptions({ options: { customName: TBMEndpoints.RouteSections } })
export class dbTBM_RouteSections extends TimeStamps {
  @prop({ required: true })
  public _id!: number;

  @prop({ type: () => [[Number, Number]], required: true })
  public coords!: Coords[];

  @prop({ required: true, enum: VehicleType })
  public vehicule!: VehicleType;

  @prop({ required: true, ref: () => dbTBM_Stops, type: () => Number })
  public rg_sv_arret_p_nd!: Ref<dbTBM_Stops>;

  @prop({ required: true, ref: () => dbTBM_Stops, type: () => Number })
  public rg_sv_arret_p_na!: Ref<dbTBM_Stops>;
}

export default function init(db: Connection): ReturnModelType<typeof dbTBM_RouteSections> {
  if (getModelForClass(dbTBM_RouteSections, { existingConnection: db }))
    deleteModelWithClass(dbTBM_RouteSections);

  return getModelForClass(dbTBM_RouteSections, { existingConnection: db });
}

export type dbTBM_RouteSectionsModel = ReturnType<typeof init>;
