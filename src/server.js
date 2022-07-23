const express = require("express");
const { NodeClient } = require("hs-client");
const NodeCache = require("node-cache");

const logger = require("./logger");
const { Resolver, ResolutionError } = require("./resolver");

const hsClientOptions = {
  network: process.env.HSD_NETWORK || "main",
  host: process.env.HSD_HOST || "localhost",
  port: Number(process.env.HSD_PORT) || 12037,
  apiKey: process.env.HSD_API_KEY || "foo",
};

/**
 * Responsible for spinning up and configuring an ExpressJS instance.
 */
class Server {
  /**
   * Create a server instance.
   */
  constructor() {
    this.app = express();
    this.resolver = new Resolver(hsClientOptions);
    this.configure();
  }

  /**
   * Configures routing
   */
  configure() {
    this.app.get("/hnsres/:name", async (req, res) => {
      try {
        const result = await this.resolver.resolve(req.params.name);
        if (result.registry) {
          result.skylink;
        }
        res.json(result);
      } catch (error) {
        res.status(error.code || 500).send(`Handshake error: ${error.message}`);
      }
    });
  }

  /**
   * Starts the HTTP server
   *
   * @param {number} port
   * @param {string} host
   */
  start(port, host = "0.0.0.0") {
    this.server = this.app.listen(port, host, (error) => {
      if (error) throw error;

      logger.info(`Server listening at http://${host}:${port}`);
    });
  }
}

module.exports = {
  Server,
};
