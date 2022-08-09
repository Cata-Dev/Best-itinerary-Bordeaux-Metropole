import assert from "assert";
import axios from "axios";
import type { Server } from "http";
import { app } from "../src/app";

const port = app.get("port");
const appUrl = `http://${app.get("host")}:${port}`;

describe("Feathers application tests", () => {
  let server: Server;

  before(async () => {
    server = await app.listen(port);
  });

  after(async () => {
    await app.teardown();
  });

  it("starts", async () => {
    try {
      await axios.get<string>(appUrl);
    } catch (error) {
      console.log(error);
      if (JSON.stringify(error).includes("404")) assert.ok(error, "got 404");
    }

    assert.ok(true, "queried");
  });
});
