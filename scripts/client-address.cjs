// Preloaded by the server start (node -r ./client-address.cjs server.js). Puts the address of the
// connection a request came in on into the x-c2r-client-address header, overwriting anything a
// client sent under that name, so sign-in throttling (src/lib/auth.ts, clientAddress) can count per
// address without trusting X-Forwarded-For. Next.js route handlers are not given the socket, and
// Next fills X-Forwarded-For only when a client did not send one, so that header can be forged.
"use strict";
// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS preload (node -r) runs before any ESM loader
const http = require("node:http");
const emit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, req, ...rest) {
  if (event === "request" && req && req.headers) {
    req.headers["x-c2r-client-address"] = (req.socket && req.socket.remoteAddress) || "";
  }
  return emit.call(this, event, req, ...rest);
};
