// Vercel serverless adapter for the TanStack Start fetch handler.
// vite.config.ts emits dist/server/server.js (a Web-standards `fetch`-style
// handler). This file wraps it in a classic Node (req, res) handler so the
// Vercel Node runtime can route to it. The vercel.json rewrite sends every
// non-asset request here.

import { Readable } from "node:stream";
import server from "../dist/server/server.js";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const protocol =
    (req.headers["x-forwarded-proto"] &&
      String(req.headers["x-forwarded-proto"]).split(",")[0]) ||
    "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const hasBody = !["GET", "HEAD"].includes(
    (req.method || "GET").toUpperCase(),
  );
  const request = new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    // Required when streaming a request body in Node 20+
    duplex: "half",
  });

  const response = await server.fetch(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    // Vercel's res.setHeader handles arrays fine; raw fetch headers are flat.
    res.setHeader(key, value);
  });

  if (response.body) {
    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);
    nodeStream.on("error", (err) => {
      // Avoid hanging connections on stream errors.
      console.error("[ssr] response stream error", err);
      try {
        res.end();
      } catch {
        // ignore
      }
    });
  } else {
    res.end();
  }
}
