import { log } from "./logger.js";
import { runServer } from "./server.js";

runServer().catch((error: unknown) => {
  log("error", error instanceof Error ? error.message : "fatal startup error");
  process.exit(1);
});
