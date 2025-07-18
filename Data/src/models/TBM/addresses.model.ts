// addresses-model.js - A mongoose model
//
// See http://mongoosejs.com/docs/models.html

import { Coords } from "@bibm/common/geographics";
import { type ReturnModelType, deleteModelWithClass, getModelForClass, prop } from "@typegoose/typegoose";
import { TimeStamps } from "@typegoose/typegoose/lib/defaultClasses";
import { modelOptions } from "@typegoose/typegoose/lib/modelOptions";
import { Connection } from "mongoose";
import { TBMEndpoints } from ".";

@modelOptions({ options: { customName: TBMEndpoints.Addresses } })
export class dbAddresses extends TimeStamps {
  @prop({ required: true })
  public _id!: number;

  @prop({ type: () => [Number, Number], required: true })
  public coords!: Coords;

  @prop({ required: true })
  public numero!: number;

  @prop()
  public rep?: string;

  @prop({ required: true })
  public type_voie!: string;

  @prop({ required: true })
  public nom_voie!: string;

  @prop({ required: true })
  public nom_voie_norm!: string;

  @prop({ required: true })
  public code_postal!: number;

  @prop({ required: true })
  public fantoir!: string;

  @prop({ required: true })
  public commune!: string;
}

export default function init(db: Connection): ReturnModelType<typeof dbAddresses> {
  if (getModelForClass(dbAddresses, { existingConnection: db })) deleteModelWithClass(dbAddresses);

  return getModelForClass(dbAddresses, { existingConnection: db });
}

export type dbAddressesModel = ReturnType<typeof init>;
