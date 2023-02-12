// intersections-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { InferSchemaType, Schema } from "mongoose";
import { TBMEndpoints } from "../index";

const dbIntersections = new Schema(
  {
    coords: { type: [Number], required: true },
    _id: { type: Number, required: true },
    nature: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);

export type dbIntersections = InferSchemaType<typeof dbIntersections>;

// for more of what you can do here.
export default function (app: Application) {
  const modelName = TBMEndpoints.Intersections;
  const mongooseClient = app.get("mongooseClient");

  // This is necessary to avoid model compilation errors in watch mode
  // see https://mongoosejs.com/docs/api/connection.html#connection_Connection-deleteModel
  if (mongooseClient.modelNames().includes(modelName)) {
    mongooseClient.deleteModel(modelName);
  }
  return mongooseClient.model(modelName, dbIntersections);
}
