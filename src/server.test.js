const fetch = require("node-fetch");
const { Server } = require("./server");
const { Resolver, ResolutionError } = require("./resolver");

describe("Server", () => {
  const app = new Server();

  beforeAll(() => {
    app.start(1234);
  });

  afterAll(() => {
    app.server.close();
  });

  describe("/hnsres/:name route", () => {
    describe("when error is returned", () => {
      beforeAll(() => {
        jest.spyOn(app.resolver, "resolve").mockRejectedValue(new Error("<script>alert(0);</script>"));
      });

      it("responds with content-type: text/plain", async () => {
        const response = await fetch("http://0.0.0.0:1234/hnsres/wrong-domain.com");

        expect(response.headers.get("content-type")).toEqual("text/plain; charset=utf-8");
      });
    });

    describe("when domain is configured with a skylink", () => {
      const configuredSkylink = "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA";

      beforeAll(() => {
        jest.spyOn(app.resolver, "resolve").mockResolvedValue({ skylink: configuredSkylink });
      });

      it("responds with json data", async () => {
        const response = await fetch("http://0.0.0.0:1234/hnsres/skylink-test");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          skylink: configuredSkylink,
        });
      });
    });

    describe("when domain is configured with a registry entry", () => {
      const configuredRegistryEntry = {
        publickey: "abcd-1234",
        datakey: "abcd-1234-efgh-5678",
      };

      beforeAll(() => {
        jest.spyOn(app.resolver, "resolve").mockResolvedValue({
          registry: configuredRegistryEntry,
        });
      });

      it("responds with json data", async () => {
        const response = await fetch("http://0.0.0.0:1234/hnsres/registry-test");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          registry: configuredRegistryEntry,
        });
      });
    });

    describe("when there are no handshake records for a given domain", () => {
      const domain = "fake-domain";

      beforeAll(() => {
        jest.spyOn(app.resolver, "resolve").mockImplementation(() => {
          throw new ResolutionError(`No records found for ${domain}`);
        });
      });

      it("responds with 404 error", async () => {
        const response = await fetch(`http://0.0.0.0:1234/hnsres/${domain}`);

        expect(response.status).toBe(404);
        expect(await response.text()).toEqual(`Handshake error: No records found for ${domain}`);
      });
    });

    describe("when there are handshake records, but aren't skynet-compatible", () => {
      const domain = "fake-skynet-domain";

      beforeAll(() => {
        jest.spyOn(app.resolver, "resolve").mockImplementation(() => {
          throw new Error(`No skynet compatible records found in dns records of ${domain}`);
        });
      });

      it("responds with 500 error", async () => {
        const response = await fetch(`http://0.0.0.0:1234/hnsres/${domain}`);

        expect(response.status).toBe(500);
        expect(await response.text()).toEqual(
          `Handshake error: No skynet compatible records found in dns records of ${domain}`
        );
      });
    });
  });
});
