import assert from "assert";
import { app } from "../../../src/app";

describe("refresh-data service", () => {
  it("registered the service", () => {
    const service = app.service("refresh-data");

    assert.ok(service, "Registered the service");
  });
});
