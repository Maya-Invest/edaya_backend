import configureOpenAPI from "@/http/openapi";
import createApp from "@/http/create-app";
import appRouter from "@/app-router";
import { mountGraphQLRoute } from "@/lib/graphql";

const app = createApp();

configureOpenAPI(app);
mountGraphQLRoute(app);

const routes = [appRouter] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
