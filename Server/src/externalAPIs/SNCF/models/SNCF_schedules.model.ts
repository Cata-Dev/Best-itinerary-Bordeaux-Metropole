// sncf_schedules-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { InferSchemaType, Schema } from "mongoose";

const dbSNCF_Schedules = new Schema(
  {
    _id: { type: String, required: true },
    realtime: { type: Date, required: true },
    trip: { type: Number, required: true }, //implicitly includes direction
    stop_point: { type: Number, required: true, ref: "sncf_stops" },
    route: { type: String, required: true, ref: "sncf_routes" },
  },
  {
    timestamps: true,
  },
);

export type dbSNCF_Schedules = InferSchemaType<typeof dbSNCF_Schedules>;

// for more of what you can do here.
export default function (app: Application) {
  const modelName = "sncf_route_schedules";
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model(modelName, dbSNCF_Schedules);
}
