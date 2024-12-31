import "./index.css";

import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
  faCrosshairs,
  faSearchLocation,
  faMoon,
  faSun,
  faMapPin,
  faFlag,
  faSlidersH,
  faCheckCircle,
  faExclamationTriangle,
  faTimes,
  faSpinner,
  faClock,
  faWalking,
  faBus,
  faTrain,
  faSubway,
  faShip,
  faQuestionCircle,
  faRoad,
} from "@fortawesome/free-solid-svg-icons";

library.add(
  faCrosshairs,
  faSearchLocation,
  faMoon,
  faSun,
  faMapPin,
  faFlag,
  faSlidersH,
  faCheckCircle,
  faExclamationTriangle,
  faTimes,
  faSpinner,
  faClock,
  faWalking,
  faBus,
  faTrain,
  faSubway,
  faShip,
  faQuestionCircle,
  faRoad,
);

const app = createApp(App);
app.component("FontAwesomeIcon", FontAwesomeIcon);
app.use(router);

app.mount("#app");
