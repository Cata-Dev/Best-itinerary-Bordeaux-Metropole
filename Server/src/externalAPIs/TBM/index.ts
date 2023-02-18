export enum TBMEndpoints {
  Addresses = "Addresses",
  Intersections = "Intersections",
  Sections = "Sections",
  Stops = "TBM_Stops",
  Lines = "TBM_Lines",
  // 2 different endpoints in 1 collection
  Schedules = "TBM_Schedules",
  Schedules_rt = "TBM_Schedules_rt",
  Trips = "TBM_Trips",
  Lines_routes = "TBM_Lines_routes",
}

import axios from "axios";
import { Application } from "../../declarations";
import { Endpoint } from "../endpoint";
import { bulkOps, cartographicDistance } from "../../utils";
import TBM_Addresses, { dbAddresses, dbAddressesModel } from "./models/addresses.model";
import TBM_Intersections, { dbIntersections, dbIntersectionsModel } from "./models/intersections.model";
import TBM_Sections, { dbSections, dbSectionsModel } from "./models/sections.model";
import TBM_Stops, {
  Active,
  dbTBM_Stops,
  dbTBM_StopsModel,
  StopType,
  VehicleType,
} from "./models/TBM_stops.model";
import TBM_Lines, { dbTBM_Lines, dbTBM_LinesModel } from "./models/TBM_lines.model";
import TBM_Schedules, {
  dbTBM_Schedules,
  dbTBM_SchedulesModel,
  dbTBM_Schedules_rt,
  dbTBM_Schedules_rtModel,
  RtScheduleState,
  RtScheduleType,
} from "./models/TBM_schedules.model";
import TBM_Trips, { dbTBM_Trips, dbTBM_TripsModel } from "./models/TBM_trips.model";
import TBM_Lines_routes, {
  dbTBM_Lines_routes,
  dbTBM_Lines_routesModel,
} from "./models/TBM_lines_routes.model";
import { logger } from "../../logger";

declare module "../../declarations" {
  interface ExternalAPIs {
    TBM: { endpoints: Endpoint<TBMEndpoints>[] };
  }
}

export type TBMClass<E extends TBMEndpoints | undefined = undefined> = E extends TBMEndpoints.Addresses
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
  : E extends TBMEndpoints.Schedules_rt
  ? dbTBM_Schedules_rt
  : E extends TBMEndpoints.Stops
  ? dbTBM_Stops
  : E extends TBMEndpoints.Trips
  ? dbTBM_Trips
  :
      | dbAddresses
      | dbIntersections
      | dbSections
      | dbTBM_Lines_routes
      | dbTBM_Lines
      | dbTBM_Schedules
      | dbTBM_Schedules_rt
      | dbTBM_Stops
      | dbTBM_Trips;

export type TBMModel<E extends TBMEndpoints | undefined = undefined> = E extends TBMEndpoints.Addresses
  ? dbAddressesModel
  : E extends TBMEndpoints.Intersections
  ? dbIntersectionsModel
  : E extends TBMEndpoints.Sections
  ? dbSectionsModel
  : E extends TBMEndpoints.Lines
  ? dbTBM_LinesModel
  : E extends TBMEndpoints.Lines_routes
  ? dbTBM_Lines_routesModel
  : E extends TBMEndpoints.Schedules
  ? dbTBM_SchedulesModel
  : E extends TBMEndpoints.Schedules_rt
  ? dbTBM_Schedules_rtModel
  : E extends TBMEndpoints.Stops
  ? dbTBM_StopsModel
  : E extends TBMEndpoints.Trips
  ? dbTBM_TripsModel
  :
      | dbAddressesModel
      | dbIntersectionsModel
      | dbSectionsModel
      | dbTBM_Lines_routesModel
      | dbTBM_LinesModel
      | dbTBM_SchedulesModel
      | dbTBM_Schedules_rtModel
      | dbTBM_StopsModel
      | dbTBM_TripsModel;

interface BaseTBM<T extends object = object> {
  properties: T;
}

export type Addresse = BaseTBM<{
  nom_voie: string;
  gid: string;
  numero: number;
  rep: string | null;
  cpostal: string;
  /** Fichier annuaire topographique initialisé réduit */
  fantoir: string;
  commune: string;
  cinsee: `${number}${number}${number}`;
}> & {
  geometry: { coordinates: [number, number] };
};

export type Intersection = BaseTBM<{
  gid: string;
  nature: string;
}> & {
  geometry: { coordinates: [number, number] };
};

export type Section = BaseTBM<{
  gid: string;
  domanial: string;
  groupe: number;
  nom_voie: string;
  rg_fv_graph_dbl: number;
  rg_fv_graph_nd: number;
  rg_fv_graph_na: number;
}> & {
  geometry: { coordinates: [number, number][] };
};

export type TBM_Stop = BaseTBM<{
  gid: string;
  libelle: string;
  vehicule: VehicleType;
  type: StopType;
  actif: Active;
}> & {
  geometry: { coordinates: [number, number] };
};

export type TBM_Line = BaseTBM<{
  gid: string;
  libelle: string;
  vehicule: VehicleType;
  active: Active;
}>;

export type TBM_Schedule = BaseTBM<{
  gid: string;
  hor_theo: string;
  rs_sv_arret_p: number;
  rs_sv_cours_a: number;
}>;

export type TBM_Schedule_rt = TBM_Schedule &
  BaseTBM<{
    hor_app: string;
    hor_estime: string;
    etat: RtScheduleState;
    type: RtScheduleType;
    tempsarret: number;
  }>;

export type TBM_Vehicle = BaseTBM<{
  gid: string;
  etat: string;
  rg_sv_arret_p_nd: number;
  rg_sv_arret_p_na: number;
  rs_sv_ligne_a: number;
  rs_sv_chem_l: number;
}>;

export type TBM_Lines_route = BaseTBM<{
  gid: string;
  libelle: string;
  sens: string;
  vehicule: string;
  rs_sv_ligne_a: number;
  rg_sv_arret_p_nd: number;
  rg_sv_arret_p_na: number;
}>;

export default (app: Application) => {
  logger.log(`Initializing TBM models...`);

  const Address = TBM_Addresses(app);
  const Intersection = TBM_Intersections(app);
  const Section = TBM_Sections(app);
  const Stop = TBM_Stops(app);
  const Line = TBM_Lines(app);
  const [Schedule, ScheduleRt] = TBM_Schedules(app);
  const Trip = TBM_Trips(app);
  const LinesRoute = TBM_Lines_routes(app);

  logger.info(`Models initialized.`);

  app.externalAPIs.TBM = {
    endpoints: [],
  };

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

        const Addresses: dbAddresses[] = rawAddresses.map((address) => {
          const voie = address.properties.nom_voie;
          return {
            _id: parseInt(address.properties.gid),
            coords: address.geometry.coordinates,
            numero: address.properties.numero,
            rep: address.properties.rep?.toLowerCase(),
            type_voie: voie.match(/[A-zàÀ-ÿ]+/g)?.[0] ?? "",
            nom_voie: voie,
            nom_voie_lowercase: voie.toLowerCase(),
            code_postal:
              parseInt(address.properties.cpostal) || parseInt(`33${address.properties.cinsee}`) || 0,
            fantoir: address.properties.fantoir,
            commune: address.properties.commune,
          };
        });

        await Address.deleteMany({
          _id: { $nin: Addresses.map((i) => i._id) },
        });
        await Address.bulkWrite(
          bulkOps("updateOne", Addresses as unknown as Record<keyof dbAddresses, unknown>[]),
        );

        return true;
      },
      Address,
    ),

    new Endpoint(
      TBMEndpoints.Intersections,
      24 * 3600,
      async () => {
        const rawIntersections: Intersection[] = await getData("fv_carre_p", ["crs=epsg:2154"]);

        const Intersections: dbIntersections[] = rawIntersections.map((intersection) => {
          return {
            coords: intersection.geometry.coordinates,
            _id: parseInt(intersection.properties.gid),
            nature: intersection.properties.nature,
          };
        });

        await Intersection.deleteMany({
          _id: { $nin: Intersections.map((i) => i._id) },
        });
        await Intersection.bulkWrite(
          bulkOps("updateOne", Intersections as unknown as Record<keyof dbIntersections, unknown>[]),
        );

        return true;
      },
      Intersection,
    ),

    new Endpoint(
      TBMEndpoints.Sections,
      24 * 3600,
      async () => {
        const rawSections: Section[] = await getData("fv_tronc_l", ["crs=epsg:2154"]);

        const Sections: dbSections[] = rawSections.map((section) => {
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
        await Section.bulkWrite(
          bulkOps("updateOne", Sections as unknown as Record<keyof dbSections, unknown>[]),
        );

        return true;
      },
      Section,
    ),

    new Endpoint(
      TBMEndpoints.Stops,
      24 * 3600,
      async () => {
        const rawStops: TBM_Stop[] = await getData("sv_arret_p", ["crs=epsg:2154"]);

        const Stops: dbTBM_Stops[] = rawStops.map((stop) => {
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
        await Stop.bulkWrite(bulkOps("updateOne", Stops as unknown as Record<keyof dbTBM_Stops, unknown>[]));

        return true;
      },
      Stop,
    ),

    new Endpoint(
      TBMEndpoints.Lines,
      24 * 3600,
      async () => {
        const rawLines: TBM_Line[] = await getData("sv_ligne_a");

        const Lines = rawLines.map((line) => {
          return {
            _id: parseInt(line.properties.gid),
            libelle: line.properties.libelle,
            vehicule: line.properties.vehicule,
            active: line.properties.active,
          };
        });

        await Line.deleteMany({ _id: { $nin: Lines.map((l) => l._id) } });
        await Line.bulkWrite(bulkOps("updateOne", Lines));

        return true;
      },
      Line,
    ),

    // Data needed
    new Endpoint(
      TBMEndpoints.Schedules,
      24 * 3600,
      async () => {
        return true;
      },
      Schedule,
    ),

    new Endpoint(
      TBMEndpoints.Schedules_rt,
      10,
      async () => {
        const date = new Date().toJSON().substring(0, 19);

        const rawSchedulesRt: TBM_Schedule_rt[] = await getData("sv_horai_a", [
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
              etat: {
                $neq: "REALISE",
              },
            }),
        ]);

        const SchedulesRt: dbTBM_Schedules_rt[] = rawSchedulesRt.map((scheduleRt) => {
          return {
            gid: parseInt(scheduleRt.properties.gid),
            realtime: true,
            hor_theo: new Date(scheduleRt.properties.hor_theo),
            hor_app: new Date(scheduleRt.properties.hor_app),
            hor_estime: new Date(scheduleRt.properties.hor_estime),
            etat: scheduleRt.properties.etat,
            type: scheduleRt.properties.type,
            rs_sv_arret_p: scheduleRt.properties.rs_sv_arret_p,
            rs_sv_cours_a: scheduleRt.properties.rs_sv_cours_a,
          };
        });

        await Schedule.deleteMany({
          realtime: true,
          gid: { $nin: SchedulesRt.map((s) => s.gid) },
        });
        await Schedule.bulkWrite(
          bulkOps("updateOne", SchedulesRt as unknown as Record<keyof dbTBM_Schedules_rt, unknown>[], [
            "gid",
            "realtime",
          ]),
        );

        return true;
      },
      ScheduleRt,
    ),

    new Endpoint(
      TBMEndpoints.Trips,
      10 * 60,
      async () => {
        const rawTrips: TBM_Vehicle[] = await getData("sv_cours_a", [
          "filter=" +
            JSON.stringify({
              etat: {
                $in: ["NON_COMMENCE", "EN_COURS"],
              },
            }),
        ]);

        const Trips: dbTBM_Trips[] = rawTrips.map((trip) => {
          return {
            _id: parseInt(trip.properties.gid),
            etat: trip.properties.etat,
            rg_sv_arret_p_nd: trip.properties.rg_sv_arret_p_nd,
            rg_sv_arret_p_na: trip.properties.rg_sv_arret_p_na,
            rs_sv_ligne_a: trip.properties.rs_sv_ligne_a,
            rs_sv_chem_l: trip.properties.rs_sv_chem_l,
          };
        });

        await Trip.deleteMany({
          _id: { $nin: Trips.map((v) => v._id) },
        });
        await Trip.bulkWrite(bulkOps("updateOne", Trips as unknown as Record<keyof dbTBM_Trips, unknown>[]));

        return true;
      },
      Trip,
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

        const Lines_routes: dbTBM_Lines_routes[] = rawLines_routes.map((lines_route) => {
          return {
            _id: parseInt(lines_route.properties.gid),
            libelle: lines_route.properties.libelle,
            sens: lines_route.properties.sens,
            vehicule: lines_route.properties.vehicule,
            rs_sv_ligne_a: lines_route.properties.rs_sv_ligne_a,
            rg_sv_arret_p_nd: lines_route.properties.rg_sv_arret_p_nd,
            rg_sv_arret_p_na: lines_route.properties.rg_sv_arret_p_na,
          };
        });
        await LinesRoute.deleteMany({
          _id: { $nin: Lines_routes.map((l_r) => l_r._id) },
        });
        await LinesRoute.bulkWrite(
          bulkOps("updateOne", Lines_routes as unknown as Record<keyof dbTBM_Lines_routes, unknown>[]),
        );

        return true;
      },
      LinesRoute,
    ),
  ];

  app.externalAPIs.endpoints.push(...app.externalAPIs.TBM.endpoints);
};
