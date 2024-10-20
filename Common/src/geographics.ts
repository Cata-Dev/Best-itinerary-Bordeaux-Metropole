const X0 = 700000;
const Y0 = 6600000;
const a = 6378137;
const e = 0.08181919106;
const l0 = (Math.PI / 180) * 3;
const lc = l0;
const phi0 = (Math.PI / 180) * 46.5;
const phi1 = (Math.PI / 180) * 44;
const phi2 = (Math.PI / 180) * 49;

const gN1 = a / Math.sqrt(1 - e * e * Math.sin(phi1) * Math.sin(phi1));
const gN2 = a / Math.sqrt(1 - e * e * Math.sin(phi2) * Math.sin(phi2));

const gl0 = Math.log(
  Math.tan(Math.PI / 4 + phi0 / 2) * Math.pow((1 - e * Math.sin(phi0)) / (1 + e * Math.sin(phi0)), e / 2),
);
const gl1 = Math.log(
  Math.tan(Math.PI / 4 + phi1 / 2) * Math.pow((1 - e * Math.sin(phi1)) / (1 + e * Math.sin(phi1)), e / 2),
);
const gl2 = Math.log(
  Math.tan(Math.PI / 4 + phi2 / 2) * Math.pow((1 - e * Math.sin(phi2)) / (1 + e * Math.sin(phi2)), e / 2),
);

const n = Math.log((gN2 * Math.cos(phi2)) / (gN1 * Math.cos(phi1))) / (gl1 - gl2);
const c = ((gN1 * Math.cos(phi1)) / n) * Math.exp(n * gl1);

/**
 * @description Converts WGS coordinates into Lambert 93 coordinates
 */
const WGSToLambert93 = (lat: number, long: number): [number, number] => {
  const phi = (Math.PI / 180) * lat;
  const l = (Math.PI / 180) * long;

  const gl = Math.log(
    Math.tan(Math.PI / 4 + phi / 2) * Math.pow((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi)), e / 2),
  );

  const ys = Y0 + c * Math.exp(-1 * n * gl0);

  return [
    X0 + c * Math.exp(-1 * n * gl) * Math.sin(n * (l - lc)),
    ys - c * Math.exp(-1 * n * gl) * Math.cos(n * (l - lc)),
  ];
};
const degToRad = (deg: number) => {
  return (deg * Math.PI) / 180;
};

/**
 * @description Get the distance between two geographic coordinates.
 * @param {Number} lon1
 * @param {Number} lat1
 * @param {Number} lon2
 * @param {Number} lat2
 * @returns {Number} The distance in meters.
 */
const geographicDistance = (lon1: number, lat1: number, lon2: number, lat2: number): number => {
  const earthRadiusKm = 6371;

  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);

  lat1 = degToRad(lat1);
  lat2 = degToRad(lat2);

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c * 1000;
};

/**
 * @description Get the distance between two cartographic coordinates.
 * @returns {Number} The distance in meters.
 */
const euclideanDistance = (x1: number, y1: number, x2: number, y2: number): number => {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

export { WGSToLambert93, geographicDistance, euclideanDistance };
