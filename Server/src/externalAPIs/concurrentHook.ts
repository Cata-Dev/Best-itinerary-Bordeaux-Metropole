import { EndpointName } from ".";
import { Application } from "../declarations";
import { Endpoint } from "./endpoint";

/**
 * Make a concurrent hook, i.e. a hook that executes when no other Endpoint that registered is fetching
 * @param hook The actual hook function to be awaited
 * @returns A register function to apply this hook to an Endpoint
 */
function makeConcurrentHook<R>(hook: (app: Application) => Promise<R> | R) {
  const concurrentEndpoints: EndpointName[] = [];

  return <N extends EndpointName>(app: Application, registeringEndpoint: N) => {
    concurrentEndpoints.push(registeringEndpoint);

    return async (endpoint: Endpoint<N>) => {
      if (concurrentEndpoints.find((e) => e != endpoint.name && app.externalAPIs.endpoints[e].fetching))
        return;

      await hook(app);
    };
  };
}

export { makeConcurrentHook };
