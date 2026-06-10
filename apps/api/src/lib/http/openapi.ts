import { Scalar } from "@scalar/hono-api-reference";

import type { AppOpenAPI } from "@/lib/http/types";

import packageJSON from "../../../package.json";

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: "Maya School Core API",
    },
  });

  app.get(
    "/reference",
    Scalar({
      url: "/doc",
      pageTitle: "Maya School Core API Reference",
      theme: "laserwave",
      layout: "classic",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
    }),
  );
}
