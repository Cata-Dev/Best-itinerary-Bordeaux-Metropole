import { createApp } from "vue";
import { router } from "./router";
import "./index.css";
import { library } from "@fortawesome/fontawesome-svg-core";
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
import {} from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

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
import App from "./App.vue";

const app = createApp(App);
app.component("FontAwesomeIcon", FontAwesomeIcon);
app.use(router);

app.mount("#app");
