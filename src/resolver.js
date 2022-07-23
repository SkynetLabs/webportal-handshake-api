const punycode = require("punycode");
const NodeCache = require("node-cache");
const { NodeClient } = require("hs-client");

const logger = require("./logger");

// Match both `sia://HASH` and `HASH` links.
const SKYLING_REGEXP = /^(sia:\/\/)?[a-zA-Z0-9_-]{46}/;
const REGISTRY_ENTRY_REGEXP = /^skyns:\/\/(?<publickey>[a-zA-Z0-9%]+)\/(?<datakey>[a-zA-Z0-9%]+)$/;

class ResolutionError extends Error {
  constructor(message, code) {
    super(message);
    this.code = 404;
  }
}

/**
 * @typedef {Object} HSRecord
 * This documentation only mentiones properties used by this service. If you need more information,
 * visit https://hsd-dev.org/guides/resource-records.html.
 *
 * @property {string}   type  Record type. In case of this application, we only care about TXT records.
 * @property {string[]} [txt] Values for TXT records.
 *                            There are many other possible properties besides .txt, but within this
 *                            application we only care about TXT records.
 *
 * @typedef {Object} RegistryEntry
 * @property {string} publickey
 * @property {string} datakey
 *
 * @typedef {Object} ResolvedSkylink
 * @property {string} skylink
 *
 * @typedef {Object} ResolvedRegistryEntry
 * @property {RegistryEntry} registry
 *
 * @typedef {Object} HSClientOptions
 * @property {string} network Target Handshake network
 * @property {string} host    Hostname of the Handshake node server
 * @property {string} port    Port of the Handshake node server
 * @property {string} apiKey  API key to be used to connect to the Handshake server
 */

/**
 * Resolver class is responsible for validating the requested domain names
 * and decoding TXT records for them, as long as they exist.
 */
class Resolver {
  /**
   * Create a Resolver instance.
   *
   * @param {HSClientOptions} hsClientOptions
   */
  constructor(hsClientOptions) {
    this.hsClient = new NodeClient(hsClientOptions);
    this.cache = new NodeCache({ stdTTL: 300 }); // cache for 5 minutes
  }
  /**
   * Try to resolve given Handshake domain into a skylink or skynet registry entry.
   *
   * @param {string} rawDomainName Domain name
   * @throws {ResolutionError}
   * @returns {ResolvedSkylink | ResolvedRegistryEntry}
   */
  async resolve(rawDomainName) {
    const domain = punycode.toASCII(rawDomainName);
    const records = await this.getDomainRecords(domain);
    if (!records) {
      throw new ResolutionError(`No records found for ${domain}`);
    }

    const record = this.findSkynetCompatibleRecord(records);
    if (!record) {
      throw new Error(`No skynet compatible records found in dns records of ${domain}`);
    }

    return this.createResponseFromCompatibleRecord(record);
  }

  /**
   * Get Handshake domain records for a given domain
   *
   * @param {string} domainName Domain name to be checked for DNS link records.
   * @returns {Promise<HSRecord[]>}
   */
  async getDomainRecords(name) {
    if (this.cache.has(name)) {
      return this.cache.get(name);
    }

    const response = await this.hsClient.execute("getnameresource", [name]);
    const records = response?.records ?? null;

    logger.info(`${name} => ${JSON.stringify(records)}`);

    this.cache.set(name, records);

    return records;
  }

  /**
   * Returns the last compatible record, so people can update their domains
   * in a non-destructive way by simply adding a new link. This will also allow
   * keeping links to older versions for backwards compatibility.
   *
   * @param {HSRecord[]} records
   * @returns {HSRecord}
   */
  findSkynetCompatibleRecord(records) {
    return records
      ?.slice()
      .reverse()
      .find(({ txt }) => txt?.some((entry) => this.isValidSkylink(entry) || this.isValidRegistryEntry(entry)));
  }

  /**
   * @param {HSRecord} [record]
   * @returns {ResolvedSkylink | ResolvedRegistryEntry}
   */
  createResponseFromCompatibleRecord(record) {
    const skylink = record?.txt?.find((entry) => this.isValidSkylink(entry));

    if (skylink) return { skylink };

    const entry = record?.txt?.find((entry) => this.isValidRegistryEntry(entry));

    if (entry) {
      const match = entry.match(registryEntryRegExp);

      if (match)
        return {
          registry: {
            publickey: decodeURIComponent(match.groups.publickey),
            datakey: decodeURIComponent(match.groups.datakey),
          },
        };
    }

    throw new Error(`No skylink in record: ${JSON.stringify(record)}`);
  }

  /**
   * Checks if the given string is a valid Sia link.
   *
   * @param {string} value
   * @returns {boolean}
   */
  isValidSkylink(value) {
    return Boolean(value && value.match(SKYLING_REGEXP));
  }

  /**
   * Checks if given string is a valid skynet registry entry
   *
   * @param {string} value
   * @returns {boolean}
   */
  isValidRegistryEntry(value) {
    return Boolean(value && value.match(REGISTRY_ENTRY_REGEXP));
  }
}

module.exports = {
  Resolver,
  ResolutionError,
};
