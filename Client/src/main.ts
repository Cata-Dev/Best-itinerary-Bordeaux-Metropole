import "./index.css";

import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
  faBus,
  faCheckCircle,
  faClock,
  faCrosshairs,
  faExclamationTriangle,
  faFlag,
  faMap,
  faMapPin,
  faMoon,
  faQuestionCircle,
  faRoad,
  faSearchLocation,
  faShip,
  faSlidersH,
  faSpinner,
  faSubway,
  faSun,
  faTimes,
  faTrain,
  faWalking,
} from "@fortawesome/free-solid-svg-icons";

library.add(
  faBus,
  faCheckCircle,
  faClock,
  faCrosshairs,
  faExclamationTriangle,
  faFlag,
  faMap,
  faMapPin,
  faMoon,
  faQuestionCircle,
  faRoad,
  faSearchLocation,
  faShip,
  faSlidersH,
  faSpinner,
  faSubway,
  faSun,
  faTimes,
  faTrain,
  faWalking,
);

const app = createApp(App);
app.component("FontAwesomeIcon", FontAwesomeIcon);
app.use(router);

app.mount("#app");
