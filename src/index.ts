import "dotenv/config";
import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp(env);

  const host = "0.0.0.0";
  await app.listen({ port: env.PORT, host });
  console.log(`Orchestrator listening on http://${host}:${env.PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
