// tbm_schedules-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { InferSchemaType, Schema } from "mongoose";
import { TBMEndpoints } from "../index";

const dbTBM_Schedules = new Schema(
  {
    gid: { type: Number, required: true, index: true },
    hor_theo: { type: Date, required: true },
    hor_app: { type: Date },
    hor_estime: { type: Date },
    etat: {
      type: String,
      enum: ["NON_REALISE", "REALISE", "DEVIE"],
    },
    type: { type: String, enum: ["REGULIER", "DEVIATION"] },
    realtime: { type: Boolean, required: true },
    rs_sv_arret_p: { type: Number, required: true, ref: TBMEndpoints.Stops },
    rs_sv_cours_a: { type: Number, required: true, ref: TBMEndpoints.Trips },
  },
  {
    timestamps: true,
  },
);
dbTBM_Schedules.index({ gid: 1, realtime: 1 });

export type dbTBM_Schedules = InferSchemaType<typeof dbTBM_Schedules>;

// for more of what you can do here.
export default function (app: Application) {
  const modelName = TBMEndpoints.Schedules;
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model(modelName, dbTBM_Schedules);
}
