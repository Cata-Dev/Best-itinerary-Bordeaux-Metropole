// tbm_vehicles-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { InferSchemaType, Schema } from "mongoose";
import { TBMEndpoints } from "../index";

const dbTBM_Trips = new Schema(
  {
    _id: { type: Number, required: true },
    etat: { type: String, required: true },
    rs_sv_ligne_a: { type: Number, ref: TBMEndpoints.Lines },
    rg_sv_arret_p_nd: { type: Number, required: true, ref: TBMEndpoints.Stops },
    rg_sv_arret_p_na: { type: Number, required: true, ref: TBMEndpoints.Stops },
    rs_sv_chem_l: { type: Number, ref: TBMEndpoints.Lines_routes },
  },
  {
    timestamps: true,
  },
);

export type dbTBM_Trips = InferSchemaType<typeof dbTBM_Trips>;

// for more of what you can do here.
export default function (app: Application) {
  const modelName = TBMEndpoints.Trips;
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model(modelName, dbTBM_Trips);
}
