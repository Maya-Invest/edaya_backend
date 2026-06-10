import configureOpenAPI from "@/lib/http/openapi";
import createApp from "@/lib/http/create-app";
import appRouter from "@/app-router";

const app = createApp();

configureOpenAPI(app);

const routes = [appRouter] as const;

routes.forEach((route) => {
  app.route("/", route);
});

export type AppType = typeof routes[number];

export default app;
