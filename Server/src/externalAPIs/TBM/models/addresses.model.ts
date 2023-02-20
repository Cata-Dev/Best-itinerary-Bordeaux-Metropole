// addresses-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Application } from "../../../declarations";
import { TBMEndpoints } from "../index";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { addModelToTypegoose, buildSchema, prop } from "@typegoose/typegoose";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { getName } from "@typegoose/typegoose/lib/internal/utils";

@modelOptions({ options: { customName: TBMEndpoints.Addresses } })
export class dbAddresses extends TimeStamps {
  @prop({ required: true })
  public _id!: number;

  @prop({ type: () => [Number, Number], required: true })
  public coords!: [number, number];

  @prop({ required: true })
  public numero!: number;

  @prop()
  public rep?: string;

  @prop({ required: true })
  public type_voie!: string;

  @prop({ required: true })
  public nom_voie!: string;

  @prop({ required: true })
  public nom_voie_lowercase!: string;

  @prop({ required: true })
  public code_postal!: number;

  @prop({ required: true })
  public fantoir!: string;

  @prop({ required: true })
  public commune!: string;
}

export default function init(app: Application) {
  const mongooseClient = app.get("mongooseClient");

  const dbAddressesSchema = buildSchema(dbAddresses, { existingConnection: mongooseClient });
  const dbAddressesModelRaw = mongooseClient.model(getName(dbAddresses), dbAddressesSchema);

  return addModelToTypegoose(dbAddressesModelRaw, dbAddresses, { existingConnection: mongooseClient });
}

export type dbAddressesModel = ReturnType<typeof init>;
