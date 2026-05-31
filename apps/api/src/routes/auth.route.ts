import { createRouter } from "@/lib/create-app";
import { auth } from "@/auth";

const authRouter = createRouter()
  .on(["POST", "GET"], "/*", (c) => {
    return auth.handler(c.req.raw);
  });

export default authRouter;
