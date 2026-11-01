/* eslint-disable node/no-process-env -- Local and fixture process configuration. */
/** Compatibility entry for existing isolated CI stacks. */
import { startTestingServer } from "../../testing/server";

await startTestingServer(process.env);
