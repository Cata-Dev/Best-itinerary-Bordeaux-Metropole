// sncf_stops-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { InferSchemaType, Schema } from "mongoose";

const dbSNCF_Stops = new Schema(
  {
    _id: { type: Number, required: true },
    coords: { type: [Number], required: true },
    name: { type: String, required: true },
    name_lowercase: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export type dbSNCF_Stops = InferSchemaType<typeof dbSNCF_Stops>;

// for more of what you can do here.
export default function (app: Application) {
  const modelName = "sncf_stops";
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model(modelName, dbSNCF_Stops);
}
