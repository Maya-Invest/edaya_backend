import { registerAuthContract } from "@/identity/openapi";
import { Scalar } from "@scalar/hono-api-reference";

import type { AppOpenAPI } from "@/http/types";

import packageJSON from "../../package.json";

export default function configureOpenAPI(app: AppOpenAPI) {
  registerAuthContract(app);
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: packageJSON.version,
      title: "EDaya API",
    },
  });

  app.get(
    "/reference",
    Scalar({
      pageTitle: "EDaya API Reference",
      theme: "laserwave",
      layout: "classic",
      sources: [
        { url: "/doc", title: "School and Authentication API" },
      ],
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
    }),
  );
}
