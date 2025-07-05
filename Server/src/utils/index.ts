import { ReturnModelType } from "@typegoose/typegoose";
import { AnyParamConstructor } from "@typegoose/typegoose/lib/types";
import type { BulkWriteResult, DeleteResult } from "mongodb";
import { FilterQuery } from "mongoose";

type SupportedBulkOp = "updateOne" | "deleteOne";
export function formatDocToBulkOps<K extends string | number | symbol, D extends Record<K, unknown>>(
  op: SupportedBulkOp,
  doc: D,
  filterKeys: K[],
) {
  switch (op) {
    case "updateOne":
      return {
        updateOne: {
          filter: filterKeys.reduce(
            (acc, v) => ({
              ...acc,
              [v]: doc[v],
            }),
            {},
          ),
          update: doc,
          upsert: true,
        },
      };

    case "deleteOne":
      return {
        deleteOne: {
          filter: filterKeys.reduce(
            (acc, v) => ({
              ...acc,
              [v]: doc[v],
            }),
            {},
          ),
        },
      };
  }
}

/**
 * @description Format documents to be operated via bulkWrite
 */
export function bulkOps<K extends string | number | symbol, D extends Record<K, unknown>>(
  op: SupportedBulkOp,
  documents: D[],
  filterKeys: K[],
) {
  return documents.map((doc) => formatDocToBulkOps(op, doc, filterKeys));
}

export function bulkUpsertAndPurge<
  // Schema
  S extends AnyParamConstructor<unknown>,
  // Keys
  K extends string | number | symbol,
  // Documents
  D extends InstanceType<S> & Record<K, unknown>,
>(model: ReturnModelType<S>, docs: D[], keys: K[]): Promise<[BulkWriteResult, DeleteResult]> {
  return Promise.all([
    model.bulkWrite(bulkOps("updateOne", docs, keys)),
    model.deleteMany(
      keys.length == 1
        ? ({ [keys[0]]: { $nin: docs.map((doc) => doc[keys[0]]) } } as FilterQuery<D>)
        : {
            $nor: docs.map<FilterQuery<D>>((doc) => keys.reduce((acc, v) => ({ ...acc, [v]: doc[v] }), {})),
          },
    ),
  ]);
}

export const sumObj = <T extends number>(obj: Record<string, T> = {}, keys = []) => {
  return keys
    .map((k) => String(k))
    .filter((k) => k in obj)
    .reduce((acc, v) => acc + obj[v], 0);
};

/**
 * @param {Date} date
 * @param {boolean} includeMs Un booléen indiquant s'il faut inclure les millisecondes
 * @returns {string} Une date au format "HH:MiMi:SS"
 */
export function compactDate(date: Date | number, includeMs: boolean): string {
  if (!(date instanceof Date)) date = new Date(date);
  try {
    let h: number | string = date.getHours();
    let mi: number | string = date.getMinutes();
    let s: number | string = date.getSeconds();
    let ms: number | string = date.getMilliseconds();

    if (h < 10) h = "0" + h;
    if (mi < 10) mi = "0" + mi;
    if (s < 10) s = "0" + s;
    if (ms < 100) ms = "0" + ms;
    else if (ms < 10) ms = "00" + ms;
    return `${h}:${mi}:${s}${includeMs ? `.${ms}` : ""}`;
  } catch (_) {
    return "?";
  }
}
