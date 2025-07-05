<script setup lang="ts">
import type { Coords } from "@bibm/common/geographics";
import Feature from "ol/Feature";
import Map from "ol/Map.js";
import View from "ol/View.js";
import { MultiLineString } from "ol/geom";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import { setUserProjection } from "ol/proj";
import { register } from "ol/proj/proj4.js";
import OSM from "ol/source/OSM.js";
import VectorSource from "ol/source/Vector.js";
import { type StyleLike } from "ol/style/Style";
import proj4 from "proj4";
import { onMounted, watch } from "vue";

export interface Props {
  multiLineStrings: {
    data: {
      coords: Coords[][];
      props: Record<string, unknown>;
    }[];
    style: StyleLike;
  };
}
const props = defineProps<Props>();

proj4.defs(
  "EPSG:9794",
  "+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs",
);
register(proj4);
setUserProjection("EPSG:9794");

function makeMLSLayer(multiLineStrings: Props["multiLineStrings"]) {
  return new VectorLayer({
    source: new VectorSource({
      features: multiLineStrings.data.map(
        (mls) =>
          new Feature({
            geometry: new MultiLineString(mls.coords),
            props: mls.props,
          }),
      ),
    }),
    style: multiLineStrings.style,
  });
}

let multiLineStringsLayer = makeMLSLayer(props.multiLineStrings);

watch(
  () => props.multiLineStrings,
  (multiLineStrings) => {
    map.removeLayer(multiLineStringsLayer);
    map.addLayer((multiLineStringsLayer = makeMLSLayer(multiLineStrings)));

    // Center on the final updated layer
    const newFootLayerExtent = multiLineStringsLayer.getSource()?.getExtent();
    if (newFootLayerExtent && newFootLayerExtent.every((v) => v > -Infinity && v < Infinity))
      map.getView().fit(newFootLayerExtent, {
        padding: [50, 50, 50, 50],
        duration: 1,
      });
  },
  { deep: true },
);

const map = new Map({
  layers: [new TileLayer({ source: new OSM() }), multiLineStringsLayer],
  view: new View({
    projection: "EPSG:9794",
    center: [417210.8086218268, 6421659.081475512],
    zoom: 0,
    extent: [393459.1068995, 6411132.3387014, 427989.9724564, 6443896.092336],
  }),
});

onMounted(() => map.setTarget("map"));
</script>

<template>
  <div id="map" class="w-[75vw] h-[75vh]"></div>
</template>

<style>
@import "../../node_modules/ol/ol.css";
</style>
