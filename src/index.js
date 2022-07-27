const { Server } = require("./server");

const host = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT) || 3100;

const server = new Server();

server.start(port, host);
