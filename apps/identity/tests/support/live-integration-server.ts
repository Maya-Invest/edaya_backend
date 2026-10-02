/** Compatibility entry for existing isolated CI stacks. */
import { startTestingServer } from "../../testing/server";

await startTestingServer(process.env);
