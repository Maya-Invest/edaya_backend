/* eslint-disable node/no-process-env -- Local and fixture process configuration. */
/** Dedicated local/CI entry. Production Worker and development launcher never import this isolated entry. */
import { startTestingServer } from "../testing/server";

void startTestingServer(process.env).catch(() => {
  console.error("Unable to start Testing Identity. Use NODE_ENV=test and local test configuration.");
  process.exitCode = 1;
});
