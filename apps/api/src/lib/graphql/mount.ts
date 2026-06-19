import { graphqlServer } from "@hono/graphql-server";
import type { Hono } from "hono";
import type { AppBindings } from "@/http/types";
import { isGraphiQLEnabled, renderGraphiQLPage, resolveGraphiQLDevApiKey } from "@/lib/graphql/graphiql";
import { handleGraphiQLLogin, handleGraphiQLLogout } from "@/lib/graphql/graphiql-login";
import { handleGraphiQLSession } from "@/lib/graphql/graphiql-session";
import { buildGraphQLEntitySchema } from "@/lib/graphql/routes/entities";

const graphQLEntitySchema = buildGraphQLEntitySchema();
const graphiqlEnabled = isGraphiQLEnabled();

export function mountGraphQLRoute(app: Hono<AppBindings>) {
  app.all("/graphql", graphqlServer({
    schema: graphQLEntitySchema,
    graphiql: graphiqlEnabled,
  }));

  if (graphiqlEnabled) {
    app.get("/graphiql/session", handleGraphiQLSession);
    app.post("/graphiql/login", handleGraphiQLLogin);
    app.post("/graphiql/logout", handleGraphiQLLogout);
    app.get("/graphiql", (c) => c.html(renderGraphiQLPage({
      devApiKey: resolveGraphiQLDevApiKey(),
      webappOrigin: process.env.GRAPHIQL_WEBAPP_ORIGIN,
      defaultEmail: process.env.GRAPHIQL_DEFAULT_EMAIL,
    })));
  }
}

export { graphQLEntitySchema, graphiqlEnabled };
