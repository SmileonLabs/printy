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

function shouldUseNativeContainer(pathname) {
  return (
    pathname.startsWith("/api/admin/") ||
    pathname === "/api/logo-reference-images" ||
    pathname === "/api/logos/generate" ||
    pathname === "/api/logos/vectorize" ||
    /^\/uploads\/logo-reference-images\/[^/]+$/.test(pathname) ||
    /^\/uploads\/generated-logos\/[^/]+$/.test(pathname) ||
    /^\/uploads\/admin\/business-card-backgrounds\/[^/]+$/.test(pathname) ||
    /^\/api\/templates\/[^/]+\/business-card-pdf$/.test(pathname)
  );
}

function proxyToMainWorker(request, env) {
  const mainWorkerOrigin = env.PRINTY_MAIN_WORKER_ORIGIN?.trim();

  if (!mainWorkerOrigin) {
    return new Response("Main Worker origin is not configured.", { status: 502 });
  }

  const targetUrl = new URL(request.url);
  const origin = new URL(mainWorkerOrigin);
  targetUrl.protocol = origin.protocol;
  targetUrl.hostname = origin.hostname;
  targetUrl.port = origin.port;

  return fetch(new Request(targetUrl, request));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!shouldUseNativeContainer(url.pathname)) {
      return proxyToMainWorker(request, env);
    }

    const container = env.PRINTY_CONTAINER.getByName("printy-main-v3");
    await container.startAndWaitForPorts(3000, {
      instanceGetTimeoutMS: 30_000,
      portReadyTimeoutMS: 90_000,
      waitInterval: 1_000,
    });
    return container.fetch(request);
  },
};
