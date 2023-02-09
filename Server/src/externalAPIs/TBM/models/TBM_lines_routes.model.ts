// tbm_lines_routes-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { InferSchemaType, Schema } from "mongoose";
import { TBMEndpoints } from "../index";

const dbTBM_Lines_routes = new Schema(
  {
    _id: { type: Number, required: true },
    libelle: { type: String, required: true },
    sens: { type: String, required: true },
    vehicule: { type: String, required: true },
    rs_sv_ligne_a: { type: Number, required: true, ref: "lines" },
    rg_sv_arret_p_nd: { type: Number, required: true, ref: "stops" },
    rg_sv_arret_p_na: { type: Number, required: true, ref: "stops" },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
  },
);

export type dbTBM_Lines_routes = InferSchemaType<typeof dbTBM_Lines_routes>;

// for more of what you can do here.
export default function (app: Application) {
  const modelName = TBMEndpoints.Lines_routes;
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model(modelName, dbTBM_Lines_routes);
}
