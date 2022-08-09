// tbm_lines-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { InferSchemaType, Schema } from "mongoose";

const dbTBM_Lines = new Schema(
  {
    _id: { type: Number, required: true },
    libelle: { type: String, required: true },
    vehicule: { type: String, enum: ["BUS", "TRAM", "BATEAU"], required: true },
    active: { type: Number, enum: [0, 1], required: true },
  },
  {
    timestamps: true,
  },
);

export type dbTBM_Lines = InferSchemaType<typeof dbTBM_Lines>;

// for more of what you can do here.
export default function (app: Application) {
  const modelName = "tbm_lines";
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model(modelName, dbTBM_Lines);
}
