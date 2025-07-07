import "./index.css";

import { library } from "@fortawesome/fontawesome-svg-core";
import {
  faBus,
  faCheckCircle,
  faCircleHalfStroke,
  faClock,
  faCrosshairs,
  faExclamationTriangle,
  faFlag,
  faMap,
  faMapPin,
  faQuestionCircle,
  faRoad,
  faSearchLocation,
  faShip,
  faSlidersH,
  faSpinner,
  faSubway,
  faTimes,
  faTrain,
  faWalking,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";

library.add(
  faBus,
  faCheckCircle,
  faClock,
  faCrosshairs,
  faExclamationTriangle,
  faCircleHalfStroke,
  faFlag,
  faMap,
  faMapPin,
  faQuestionCircle,
  faRoad,
  faSearchLocation,
  faShip,
  faSlidersH,
  faSpinner,
  faSubway,
  faTimes,
  faTrain,
  faWalking,
);

const app = createApp(App);
app.component("FontAwesomeIcon", FontAwesomeIcon);
app.use(router);

app.mount("#app");
