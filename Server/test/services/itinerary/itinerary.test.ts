import assert from "assert";
import { app } from "../../../src/app";

describe("journey service", () => {
  it("registered the service", () => {
    const service = app.service("journey");

    assert.ok(service, "Registered the service");
  });
});
