// sections-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { InferSchemaType, Schema } from "mongoose";
import { TBMEndpoints } from "../index";

const dbSections = new Schema(
  {
    coords: { type: [[Number]], required: true },
    distance: { type: Number, required: true },
    _id: { type: Number, required: true },
    domanial: { type: Number, required: true },
    groupe: { type: Number, required: true },
    nom_voie: { type: String, required: true },
    rg_fv_graph_dbl: { type: Boolean, required: true },
    rg_fv_graph_nd: { type: Number, required: true, ref: "nodes" },
    rg_fv_graph_na: { type: Number, required: true, ref: "nodes" },
  },
  {
    timestamps: true,
  },
);

export type dbSections = InferSchemaType<typeof dbSections>;

// for more of what you can do here.
export default function (app: Application) {
  const modelName = TBMEndpoints.Sections;
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model(modelName, dbSections);
}
