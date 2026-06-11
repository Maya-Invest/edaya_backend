import { Scalar } from "@scalar/hono-api-reference";

import type { AppOpenAPI } from "@/lib/http/types";

import packageJSON from "../../../package.json";

export default function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: "Edaya Core API",
    },
  });

  app.get(
    "/reference",
    Scalar({
      pageTitle: "Edaya API Reference",
      theme: "laserwave",
      layout: "classic",
      sources: [
        { url: "/doc", title: "Core API" },
        { url: "/auth/open-api/generate-schema", title: "Auth" },
      ],
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
    }),
  );
}
