// addresses-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { Schema, InferSchemaType } from "mongoose";

const dbAddresses = new Schema(
  {
    _id: { type: Number, required: true },
    coords: { type: [Number], required: true },
    numero: { type: Number, required: true },
    rep: { type: String, required: false },
    type_voie: { type: String, required: true },
    nom_voie: { type: String, required: true },
    nom_voie_lowercase: { type: String, required: true },
    code_postal: { type: Number, required: true },
    fantoir: { type: String, required: true },
    commune: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export type dbAddresses = Omit<InferSchemaType<typeof dbAddresses>, "coords"> & {
  coords: [number, number];
};

// for more of what you can do here.
export default function (app: Application) {
  const modelName = "addresses";
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model<dbAddresses>(modelName, dbAddresses);
}
