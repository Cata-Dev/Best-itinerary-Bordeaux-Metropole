// tbm_stops-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { InferSchemaType, Schema } from "mongoose";

const dbTBM_Stops = new Schema(
  {
    coords: { type: [Number], required: true },
    _id: { type: Number, required: true },
    libelle: { type: String, required: true },
    libelle_lowercase: { type: String, required: true },
    vehicule: { type: String, enum: ["BUS", "TRAM", "BATEAU"], required: true },
    type: {
      type: String,
      enum: ["CLASSIQUE", "DELESTAGE", "AUTRE", "FICTIF"],
      required: true,
    },
    actif: { type: Number, enum: [0, 1] as const, required: true },
  },
  {
    timestamps: true,
  },
);

export type dbTBM_Stops = Omit<InferSchemaType<typeof dbTBM_Stops>, "coords"> & {
  coords: [number, number];
};

// for more of what you can do here.
export default function (app: Application) {
  const modelName = "tbm_stops";
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model<dbTBM_Stops>(modelName, dbTBM_Stops);
}
