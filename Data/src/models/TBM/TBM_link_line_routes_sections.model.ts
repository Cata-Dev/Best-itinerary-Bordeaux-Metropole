// tbm_vehicles-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import {
  deleteModelWithClass,
  getModelForClass,
  index,
  prop,
  type Ref,
  type ReturnModelType,
} from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { Connection } from "mongoose";
import { TBMEndpoints } from ".";
import { dbTBM_Lines_routes } from "./TBM_lines_routes.model";
import { dbTBM_RouteSections } from "./TBM_route_sections.model";

@index({ rs_sv_chem_l: 1, rs_sv_tronc_l: 1 }, { unique: true })
@modelOptions({ options: { customName: TBMEndpoints.LinkLineRoutesSections } })
export class dbTBM_LinkLineRoutesSections extends TimeStamps {
  @prop({ required: true, ref: () => dbTBM_Lines_routes, type: () => Number })
  public rs_sv_chem_l!: Ref<dbTBM_Lines_routes>;

  @prop({ required: true, ref: () => dbTBM_RouteSections, type: () => Number })
  public rs_sv_tronc_l!: Ref<dbTBM_RouteSections>;
}

export default function init(db: Connection): ReturnModelType<typeof dbTBM_LinkLineRoutesSections> {
  if (getModelForClass(dbTBM_LinkLineRoutesSections, { existingConnection: db }))
    deleteModelWithClass(dbTBM_LinkLineRoutesSections);

  return getModelForClass(dbTBM_LinkLineRoutesSections, { existingConnection: db });
}

export type dbTBM_LinkLineRoutesSectionsModel = ReturnType<typeof init>;
