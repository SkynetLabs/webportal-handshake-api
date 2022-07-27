[![Release](https://github.com/SkynetLabs/webportal-handshake-api/actions/workflows/ci_release.yml/badge.svg)](https://github.com/SkynetLabs/webportal-handshake-api/actions/workflows/ci_release.yml)

# Webportal Handshake API

## Development

If you want to run it locally, you'll need to run a Handshake node next to it.

You can use the [skynetlabs/hsd](https://hub.docker.com/r/skynetlabs/hsd) Docker image to do it. Here's a minimal `docker-compose.yml` file that you could use:

```
version: "3.7"

services:
  handshake:
    image: skynetlabs/hsd:3.0.1
    command: --chain-migrate=2 --wallet-migrate=1
    environment:
      - HSD_LOG_CONSOLE=true
      - HSD_HTTP_HOST=0.0.0.0
      - HSD_NETWORK=main
      - HSD_PORT=12037
      - HSD_API_KEY=foo
    ports:
      - "12037:12037"
```

Then simply run `docker-compose up` to run the Handshake node, and `yarn start` to start the Handshake API service.

> **NOTE:** Keep in mind that it may take even a few hours for the blockchain to fully synchronize - you may get resolution failures before it happens.
