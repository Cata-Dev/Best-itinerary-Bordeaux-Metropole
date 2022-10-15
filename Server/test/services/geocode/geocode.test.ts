import assert from "assert";
import { app } from "../../../src/app";

describe("geocode service", () => {
  it("registered the service", () => {
    const service = app.service("geocode");

    assert.ok(service, "Registered the service");
  });
});
