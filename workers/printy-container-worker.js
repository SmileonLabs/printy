import { Container } from "@cloudflare/containers";
import { env as workerEnv } from "cloudflare:workers";

export class PrintyContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "10m";
  envVars = {
    NODE_ENV: "production",
    PORT: "3000",
    HOSTNAME: "0.0.0.0",
    DATABASE_URL: workerEnv.DATABASE_URL,
    PGSSLMODE: workerEnv.PGSSLMODE,
    OPENAI_API_KEY: workerEnv.OPENAI_API_KEY,
    OPENAI_IMAGE_MODEL: workerEnv.OPENAI_IMAGE_MODEL,
    OPENAI_REFERENCE_ANALYSIS_MODEL: workerEnv.OPENAI_REFERENCE_ANALYSIS_MODEL,
    PRINTY_ADMIN_CONTACTS: workerEnv.PRINTY_ADMIN_CONTACTS,
    PRINTY_ADMIN_TOKEN: workerEnv.PRINTY_ADMIN_TOKEN,
    PRINTY_ALLOW_INSECURE_COOKIES: workerEnv.PRINTY_ALLOW_INSECURE_COOKIES,
    GOOGLE_CLIENT_ID: workerEnv.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: workerEnv.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: workerEnv.GOOGLE_REDIRECT_URI,
    KAKAO_CLIENT_ID: workerEnv.KAKAO_CLIENT_ID,
    KAKAO_CLIENT_SECRET: workerEnv.KAKAO_CLIENT_SECRET,
    KAKAO_REDIRECT_URI: workerEnv.KAKAO_REDIRECT_URI,
  };
}

export default {
  async fetch(request, env) {
    const container = env.PRINTY_CONTAINER.getByName("printy-main-v3");
    await container.startAndWaitForPorts(3000, {
      instanceGetTimeoutMS: 30_000,
      portReadyTimeoutMS: 90_000,
      waitInterval: 1_000,
    });
    return container.fetch(request);
  },
};
