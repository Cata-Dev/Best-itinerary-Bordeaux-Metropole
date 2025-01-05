<script setup lang="ts">
import Feature from "ol/Feature";
import Map from "ol/Map.js";
import View from "ol/View.js";
import { LineString } from "ol/geom";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import { setUserProjection } from "ol/proj";
import { register } from "ol/proj/proj4.js";
import OSM from "ol/source/OSM.js";
import VectorSource from "ol/source/Vector.js";
import Stroke from "ol/style/Stroke";
import Style from "ol/style/Style";
import proj4 from "proj4";
import { onMounted, watch } from "vue";

interface Props {
  footpaths: [number, number][][];
}
const props = defineProps<Props>();

proj4.defs(
  "EPSG:9794",
  "+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs",
);
register(proj4);
setUserProjection("EPSG:9794");

function makeFootLayer(footpaths: Props["footpaths"]) {
  return new VectorLayer({
    source: new VectorSource({
      features: footpaths.map(
        (fp) =>
          new Feature({
            geometry: new LineString(fp),
          }),
      ),
    }),
    style: new Style({
      stroke: new Stroke({
        width: 5,
        color: [0, 0, 0],
        lineDash: [10],
      }),
    }),
  });
}

let footLayer = makeFootLayer(props.footpaths);

watch(props.footpaths, (footpaths) => {
  map.removeLayer(footLayer);
  map.addLayer((footLayer = makeFootLayer(footpaths)));
});

const map = new Map({
  layers: [new TileLayer({ source: new OSM() }), footLayer],
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
@import "/node_modules/ol/ol.css";
</style>
