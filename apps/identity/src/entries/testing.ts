/** Dedicated local/CI entry. Production Worker and local entries never import it. */
import { startTestingServer } from "../../testing/server";

void startTestingServer(process.env).catch(() => {
  console.error("Unable to start Testing Identity. Use NODE_ENV=test and local test configuration.");
  process.exitCode = 1;
});
