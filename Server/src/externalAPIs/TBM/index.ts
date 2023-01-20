import axios from "axios";
import { Application } from "../../declarations";
import { Endpoint } from "../endpoint";
import { bulkOps, cartographicDistance } from "../../utils";
import TBM_Addresses, { dbAddresses } from "./models/addresses.model";
import TBM_Intersections, { dbIntersections } from "./models/intersections.model";
import TBM_Sections, { dbSections } from "./models/sections.model";
import TBM_Stops, { dbTBM_Stops } from "./models/TBM_stops.model";
import TBM_Lines, { dbTBM_Lines } from "./models/TBM_lines.model";
import TBM_Schedules, { dbTBM_Schedules } from "./models/TBM_schedules.model";
import TBM_Vehicles, { dbTBM_Vehicles } from "./models/TBM_vehicles.model";
import TBM_Lines_routes, { dbTBM_Lines_routes } from "./models/TBM_lines_routes.model";
import { Model } from "mongoose";
import { logger } from "../../logger";

export enum TBMEndpoints {
  Addresses = "Addresses",
  Intersections = "Intersections",
  Sections = "Sections",
  Stops = "TBM_Stops",
  Lines = "TBM_Lines",
  Schedules = "TBM_Schedules",
  Vehicles = "TBM_Vehicles",
  Lines_routes = "TBM_Lines_routes",
}

declare module "../../declarations" {
  interface ExternalAPIs {
    TBM: { endpoints: Endpoint<TBMEndpoints>[]; names: TBMEndpoints };
  }
}

export type TBMSchema<E extends TBMEndpoints | undefined = undefined> = E extends TBMEndpoints.Addresses
  ? dbAddresses
  : E extends TBMEndpoints.Intersections
  ? dbIntersections
  : E extends TBMEndpoints.Sections
  ? dbSections
  : E extends TBMEndpoints.Lines
  ? dbTBM_Lines
  : E extends TBMEndpoints.Lines_routes
  ? dbTBM_Lines_routes
  : E extends TBMEndpoints.Schedules
  ? dbTBM_Schedules
  : E extends TBMEndpoints.Stops
  ? dbTBM_Stops
  : E extends TBMEndpoints.Vehicles
  ? dbTBM_Vehicles
  :
      | dbAddresses
      | dbIntersections
      | dbSections
      | dbTBM_Lines_routes
      | dbTBM_Lines
      | dbTBM_Schedules
      | dbTBM_Stops
      | dbTBM_Vehicles;

export interface Addresse {
  properties: {
    nom_voie: string;
    gid: string;
    numero: number;
    rep: string | null;
    cpostal: string;
    fantoir: string;
    commune: string;
  };
  geometry: { coordinates: [number, number] };
}

export interface Intersection {
  geometry: { coordinates: [number, number] };
  properties: { gid: string; nature: string };
}

export interface Section {
  geometry: { coordinates: [number, number][] };
  properties: {
    gid: string;
    domanial: string;
    groupe: number;
    nom_voie: string;
    rg_fv_graph_dbl: number;
    rg_fv_graph_nd: number;
    rg_fv_graph_na: number;
  };
}

type Vehicle = "BUS" | "TRAM" | "BATEAU";
type Active = 0 | 1;

export interface TBM_Stop {
  geometry: { coordinates: [number, number] };
  properties: {
    gid: string;
    libelle: string;
    vehicule: Vehicle;
    type: "CLASSIQUE" | "DELESTAGE" | "AUTRE" | "FICTIF";
    actif: Active;
  };
}

export interface TBM_Line {
  properties: {
    gid: string;
    libelle: string;
    vehicule: Vehicle;
    active: Active;
  };
}

export interface TBM_Schedule {
  properties: {
    gid: string;
    hor_theo: string;
    hor_app: string;
    hor_estime: string;
    etat: "NON_REALISE" | "REALISE" | "DEVIE";
    type: "REGULIER";
    rs_sv_arret_p: number;
    rs_sv_cours_a: number;
  };
}

export interface TBM_Vehicle {
  properties: {
    gid: string;
    etat: string;
    rg_sv_arret_p_nd: number;
    rg_sv_arret_p_na: number;
    rs_sv_ligne_a: number;
    rs_sv_chem_l: number;
  };
}

export interface TBM_Lines_route {
  properties: {
    gid: string;
    libelle: string;
    sens: string;
    vehicule: string;
    rs_sv_ligne_a: number;
    rg_sv_arret_p_nd: number;
    rg_sv_arret_p_na: number;
  };
}

export default (app: Application) => {
  logger.log(`Initializing TBM models...`);

  const Address: Model<dbAddresses> = TBM_Addresses(app);
  const Intersection: Model<dbIntersections> = TBM_Intersections(app);
  const Section: Model<dbSections> = TBM_Sections(app);
  const Stop: Model<dbTBM_Stops> = TBM_Stops(app);
  const Line: Model<dbTBM_Lines> = TBM_Lines(app);
  const Schedule: Model<dbTBM_Schedules> = TBM_Schedules(app);
  const Vehicle: Model<dbTBM_Vehicles> = TBM_Vehicles(app);
  const Lines_route: Model<dbTBM_Lines_routes> = TBM_Lines_routes(app);

  logger.info(`Models initialized.`);

  app.externalAPIs.TBM = {} as never;

  /**
   * Fetch data from TBM API
   * @param {String} id dataset identifier
   * @param {Array} queries array of queries to apply
   */
  async function getData(id: string, queries: string[] = []) {
    const bURL = "https://data.bordeaux-metropole.fr/";
    const url = `geojson?key=${app.get("TBMkey")}&typename=${id}&${queries.join("&")}`;
    const { data } = await axios.get(`${bURL}${url}`, {
      maxContentLength: 4_000_000_000,
      maxBodyLength: 4_000_000_000,
    });
    return data.features;
  }

  app.externalAPIs.TBM.endpoints = [
    new Endpoint(
      TBMEndpoints.Addresses,
      24 * 3600,
      async () => {
        const rawAddresses: Addresse[] = await getData("fv_adresse_p", ["crs=epsg:2154"]);

        const Addresses: Omit<dbAddresses, "updatedAt" | "createdAt">[] = rawAddresses.map((address) => {
          const voie = address.properties.nom_voie;
          return {
            _id: parseInt(address.properties.gid),
            coords: address.geometry.coordinates,
            numero: address.properties.numero,
            rep: address.properties.rep?.toLowerCase(),
            type_voie: voie.match(/[A-zàÀ-ÿ]+/g)![0],
            nom_voie: voie,
            nom_voie_lowercase: voie.toLowerCase(),
            code_postal: parseInt(address.properties.cpostal),
            fantoir: address.properties.fantoir,
            commune: address.properties.commune,
          };
        });

        await Address.deleteMany({
          _id: { $nin: Addresses.map((i) => i._id) },
        });
        await Address.bulkWrite(bulkOps(Addresses));

        return true;
      },
      Address,
    ),

    new Endpoint(
      TBMEndpoints.Intersections,
      24 * 3600,
      async () => {
        const rawIntersections: Intersection[] = await getData("fv_carre_p", ["crs=epsg:2154"]);

        const Intersections: Omit<dbIntersections, "updatedAt" | "createdAt">[] = rawIntersections.map(
          (intersection) => {
            return {
              coords: intersection.geometry.coordinates,
              _id: parseInt(intersection.properties.gid),
              nature: intersection.properties.nature,
            };
          },
        );

        await Intersection.deleteMany({
          _id: { $nin: Intersections.map((i) => i._id) },
        });
        await Intersection.bulkWrite(bulkOps(Intersections));

        return true;
      },
      Intersection,
    ),

    new Endpoint(
      TBMEndpoints.Sections,
      24 * 3600,
      async () => {
        const rawSections: Section[] = await getData("fv_tronc_l", ["crs=epsg:2154"]);

        const Sections: Omit<dbSections, "updatedAt" | "createdAt">[] = rawSections.map((section) => {
          return {
            coords: section.geometry.coordinates,
            distance: section.geometry.coordinates.reduce((acc: number, v, i, arr) => {
              if (i < arr.length - 1) return acc + cartographicDistance(...v, ...arr[i + 1]);
              return acc;
            }, 0),
            _id: parseInt(section.properties.gid),
            domanial: parseInt(section.properties.domanial) || 0,
            groupe: section.properties.groupe || 0,
            nom_voie: section.properties.nom_voie,
            rg_fv_graph_dbl: !!section.properties.rg_fv_graph_dbl,
            rg_fv_graph_nd: section.properties.rg_fv_graph_nd,
            rg_fv_graph_na: section.properties.rg_fv_graph_na,
          };
        });

        await Section.deleteMany({
          _id: { $nin: Sections.map((s) => s._id) },
        });
        await Section.bulkWrite(bulkOps(Sections));

        return true;
      },
      Section,
    ),

    new Endpoint(
      TBMEndpoints.Stops,
      24 * 3600,
      async () => {
        const rawStops: TBM_Stop[] = await getData("sv_arret_p", ["crs=epsg:2154"]);

        const Stops: Omit<dbTBM_Stops, "updatedAt" | "createdAt">[] = rawStops.map((stop) => {
          return {
            coords: stop.geometry?.coordinates ?? [Infinity, Infinity], //out of BM
            _id: parseInt(stop.properties.gid),
            libelle: stop.properties.libelle,
            libelle_lowercase: stop.properties.libelle.toLowerCase(),
            vehicule: stop.properties.vehicule,
            type: stop.properties.type,
            actif: stop.properties.actif,
          };
        });

        await Stop.deleteMany({ _id: { $nin: Stops.map((s) => s._id) } });
        await Stop.bulkWrite(bulkOps(Stops));

        return true;
      },
      Stop,
    ),

    new Endpoint(
      TBMEndpoints.Lines,
      24 * 3600,
      async () => {
        const rawLines: TBM_Line[] = await getData("sv_ligne_a");

        const Lines: Omit<dbTBM_Lines, "updatedAt" | "createdAt">[] = rawLines.map((line) => {
          return {
            _id: parseInt(line.properties.gid),
            libelle: line.properties.libelle,
            vehicule: line.properties.vehicule,
            active: line.properties.active,
          };
        });

        await Line.deleteMany({ _id: { $nin: Lines.map((l) => l._id) } });
        await Line.bulkWrite(bulkOps(Lines));

        return true;
      },
      Line,
    ),

    new Endpoint(
      TBMEndpoints.Schedules,
      10,
      async () => {
        const date = new Date().toJSON().substring(0, 19);
        const rawSchedules: TBM_Schedule[] = await getData("sv_horai_a", [
          "filter=" +
            JSON.stringify({
              $or: [
                {
                  hor_theo: {
                    $gte: date,
                  },
                },
                {
                  hor_app: {
                    $gte: date,
                  },
                },
                {
                  hor_estime: {
                    $gte: date,
                  },
                },
              ],
            }),
        ]);

        const Schedules: Omit<dbTBM_Schedules, "updatedAt" | "createdAt">[] = rawSchedules.map((schedule) => {
          return {
            _id: parseInt(schedule.properties.gid),
            hor_theo: new Date(schedule.properties.hor_theo),
            hor_app: new Date(schedule.properties.hor_app),
            hor_estime: new Date(schedule.properties.hor_estime),
            etat: schedule.properties.etat,
            type: schedule.properties.type,
            rs_sv_arret_p: schedule.properties.rs_sv_arret_p,
            rs_sv_cours_a: schedule.properties.rs_sv_cours_a,
          };
        });

        await Schedule.deleteMany({
          _id: { $nin: Schedules.map((s) => s._id) },
        });
        await Schedule.bulkWrite(bulkOps(Schedules));

        return true;
      },
      Schedule,
    ),

    new Endpoint(
      TBMEndpoints.Vehicles,
      10 * 60,
      async () => {
        const rawVehicles: TBM_Vehicle[] = await getData("sv_cours_a", [
          "filter=" +
            JSON.stringify({
              etat: {
                $in: ["NON_COMMENCE", "EN_COURS"],
              },
            }),
        ]);

        const Vehicles: Omit<dbTBM_Vehicles, "updatedAt" | "createdAt">[] = rawVehicles.map((vehicle) => {
          return {
            _id: parseInt(vehicle.properties.gid),
            etat: vehicle.properties.etat,
            rg_sv_arret_p_nd: vehicle.properties.rg_sv_arret_p_nd,
            rg_sv_arret_p_na: vehicle.properties.rg_sv_arret_p_na,
            rs_sv_ligne_a: vehicle.properties.rs_sv_ligne_a,
            rs_sv_chem_l: vehicle.properties.rs_sv_chem_l,
          };
        });

        await Vehicle.deleteMany({
          _id: { $nin: Vehicles.map((v) => v._id) },
        });
        await Vehicle.bulkWrite(bulkOps(Vehicles));

        return true;
      },
      Vehicle,
    ),

    new Endpoint(
      TBMEndpoints.Lines_routes,
      3600,
      async () => {
        const rawLines_routes: TBM_Lines_route[] = await getData("sv_chem_l", [
          "attributes=" +
            JSON.stringify([
              "gid",
              "libelle",
              "sens",
              "vehicule",
              "rs_sv_ligne_a",
              "rg_sv_arret_p_nd",
              "rg_sv_arret_p_na",
            ]),
        ]);

        const Lines_routes: Omit<dbTBM_Lines_routes, "updatedAt" | "createdAt">[] = rawLines_routes.map(
          (lines_route) => {
            return {
              _id: parseInt(lines_route.properties.gid),
              libelle: lines_route.properties.libelle,
              sens: lines_route.properties.sens,
              vehicule: lines_route.properties.vehicule,
              rs_sv_ligne_a: lines_route.properties.rs_sv_ligne_a,
              rg_sv_arret_p_nd: lines_route.properties.rg_sv_arret_p_nd,
              rg_sv_arret_p_na: lines_route.properties.rg_sv_arret_p_na,
            };
          },
        );
        await Lines_route.deleteMany({
          _id: { $nin: Lines_routes.map((l_r) => l_r._id) },
        });
        await Lines_route.bulkWrite(bulkOps(Lines_routes));

        return true;
      },
      Lines_route,
    ),
  ];

  app.externalAPIs.endpoints.push(...app.externalAPIs.TBM.endpoints);
};
