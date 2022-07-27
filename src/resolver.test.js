const { Resolver, ResolutionError } = require("./resolver");

const INVALID_SKYLINKS = [
  "",
  "a",
  "asdasdasdasdAQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
  "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSAasdasdasd",
];

const VALID_SKYLINKS = [
  "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
  "GADTpoO0Mccp4CEsZf8hK9PrrNeREOPFwCqViuVIu60EgA",
  "_Aau8RozjVPusXc6l6DpXtepofnRZm3CGnkVQboRP3WF_g",
];

const INVALID_REGISTRY_ENTRIES = [
  "abc://1234/efgh",
  "skyns://ed25519%3Fmypublickey-mydatakey",
  "skyns://ed25519%3Fmypublickey:mydatakey",
];

const VALID_REGISTRY_ENTRIES = ["skyns://ed25519%3Fmypublickey/mydatakey"];

describe("Resolver", () => {
  let resolver;

  const resolve = () => resolver.resolve("dummy-domain");

  const mockHsClientResponse = (response) => {
    jest.spyOn(resolver.hsClient, "execute").mockResolvedValueOnce(response);
  };

  beforeEach(() => {
    resolver = new Resolver();
  });

  describe(".resolve", () => {
    it("works with skylinks", async () => {
      const skylink = "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA";
      const records = [
        {
          type: "TXT",
          txt: [skylink],
        },
      ];

      mockHsClientResponse({
        records,
      });

      expect(await resolve()).toEqual({ skylink });
    });

    it("works with registry entries", async () => {
      const registryEntry = "skyns://ed25519%3Fmypublickey/mydatakey";
      const records = [
        {
          type: "TXT",
          txt: [registryEntry],
        },
      ];

      mockHsClientResponse({
        records,
      });

      expect(await resolve()).toEqual({
        registry: {
          publickey: "ed25519?mypublickey",
          datakey: "mydatakey",
        },
      });
    });

    it("ignores non-skynet records", async () => {
      const expectedSkylink = VALID_SKYLINKS[0];

      mockHsClientResponse({
        records: [
          {
            type: "TXT",
            txt: [expectedSkylink],
          },
          {
            type: "TXT",
            txt: ["dummy-value-that's-not-a-skylink"],
          },
        ],
      });

      expect(await resolve()).toEqual({
        skylink: expectedSkylink,
      });
    });

    describe("when there are no records configured at all", () => {
      beforeEach(() => {
        mockHsClientResponse({
          records: null,
        });
      });

      it("throws a ResolutionError", async () => {
        await expect(resolver.resolve("not-configured-domain")).rejects.toThrow(ResolutionError);
      });
    });

    describe("when there are no skynet-compatible records configured", () => {
      beforeEach(() => {
        mockHsClientResponse({
          records: [
            {
              type: "TXT",
              txt: ["dummy-value-that's-not-skynet-compatible"],
            },
          ],
        });
      });

      it("throws an error", async () => {
        await expect(resolver.resolve("skynet-incompatible-domain")).rejects.toThrow(
          /No skynet compatible records found/
        );
      });
    });

    describe("when there are multiple skynet-compatible records defined", () => {
      beforeEach(() => {
        const records = VALID_SKYLINKS.map((skylink) => ({
          type: "TXT",
          txt: [skylink],
        }));

        mockHsClientResponse({
          records,
        });
      });

      it("returns the last one", async () => {
        const lastSkylink = VALID_SKYLINKS[VALID_SKYLINKS.length - 1];

        expect(await resolve()).toEqual({
          skylink: lastSkylink,
        });
      });
    });

    describe("when cache hits", () => {
      const cachedValue = [{ type: "TXT", txt: [VALID_SKYLINKS[0]] }];

      beforeEach(() => {
        jest.spyOn(resolver.cache, "has").mockReturnValue(true);
        jest.spyOn(resolver.cache, "get").mockReturnValue(cachedValue);
        jest.spyOn(resolver.hsClient, "execute");
      });

      it("returns proper data", async () => {
        expect(await resolve()).toEqual({ skylink: VALID_SKYLINKS[0] });
      });

      it("does not call HS client", async () => {
        await resolve();

        expect(resolver.cache.get).toHaveBeenCalledWith("dummy-domain");
        expect(resolver.hsClient.execute).not.toHaveBeenCalled();
      });
    });

    describe("when cache misses", () => {
      beforeEach(() => {
        jest.spyOn(resolver.cache, "has").mockReturnValue(false);

        mockHsClientResponse({
          records: [
            {
              type: "TXT",
              txt: [VALID_SKYLINKS[0]],
            },
          ],
        });
      });

      it("returns proper data", async () => {
        expect(await resolve()).toEqual({ skylink: VALID_SKYLINKS[0] });
      });

      it("calls HS client", async () => {
        await resolve();

        expect(resolver.hsClient.execute).toHaveBeenCalled();
      });
    });
  });

  describe(".isValidSkylink", () => {
    it.each(INVALID_SKYLINKS)("returns false for invalid skylinks", (skylink) => {
      expect(resolver.isValidSkylink(skylink)).toBe(false);
    });

    it.each(VALID_SKYLINKS)("returns true for valid skylinks", (skylink) => {
      expect(resolver.isValidSkylink(skylink)).toBe(true);
    });
  });

  describe(".isValidRegistryEntry", () => {
    it.each(INVALID_REGISTRY_ENTRIES)("returns false for invalid skylinks", (entry) => {
      expect(resolver.isValidRegistryEntry(entry)).toBe(false);
    });

    it.each(VALID_REGISTRY_ENTRIES)("returns true for valid skylinks", (entry) => {
      expect(resolver.isValidRegistryEntry(entry)).toBe(true);
    });
  });
});
