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
    PRINTY_LOGO_GENERATION_MAX_RUNNING: workerEnv.PRINTY_LOGO_GENERATION_MAX_RUNNING,
    PRINTY_JOB_PROCESSOR_TOKEN: workerEnv.PRINTY_JOB_PROCESSOR_TOKEN,
    GOOGLE_CLIENT_ID: workerEnv.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: workerEnv.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: workerEnv.GOOGLE_REDIRECT_URI,
    KAKAO_CLIENT_ID: workerEnv.KAKAO_CLIENT_ID,
    KAKAO_CLIENT_SECRET: workerEnv.KAKAO_CLIENT_SECRET,
    KAKAO_REDIRECT_URI: workerEnv.KAKAO_REDIRECT_URI,
  };
}

function shouldUseNativeContainer(pathname) {
  if (pathname === "/api/admin/session" || pathname.startsWith("/api/admin/file-archive") || pathname.startsWith("/api/admin/brand-transfer")) {
    return false;
  }

  return (
    pathname.startsWith("/api/admin/") ||
    pathname === "/api/logo-reference-images" ||
    pathname === "/api/brand-mockups" ||
    pathname.startsWith("/api/ai-business-cards") ||
    pathname.startsWith("/api/print-products") ||
    pathname.startsWith("/api/brand-mockups/jobs/") ||
    pathname === "/api/logos/generate" ||
    pathname === "/api/logos/upload" ||
    pathname.startsWith("/api/logos/generation-jobs/") ||
    pathname === "/api/logos/vectorize" ||
    /^\/uploads\/logo-reference-images\/[^/]+$/.test(pathname) ||
    /^\/uploads\/generated-logos\/[^/]+$/.test(pathname) ||
    /^\/uploads\/brand-assets\/[^/]+$/.test(pathname) ||
    /^\/uploads\/admin\/business-card-backgrounds\/[^/]+$/.test(pathname)
  );
}

function promptBase(productType) {
  if (productType === "flyer") {
    return "Create a flat, front-facing printable promotional flyer background. Use a polished retail/event promotion mood, but do not include readable text, logos, QR codes, coupons, prices, people, hands, paper perspective, or mockup scenes. Leave clean open areas where Printy will overlay the user's actual headline, details, contact, and logo later.";
  }

  if (productType === "signage") {
    return "Create a single seamless horizontal abstract background artwork. Use the selected background color as the main mood and make the whole image feel premium, modern, and uninterrupted from left to right.";
  }

  return "Create a single seamless vertical abstract background artwork. Use the selected background color as the main mood and make the whole image feel premium, modern, and uninterrupted from top to bottom.";
}

async function buildPrintProductPromptResponse(request) {
  const body = await request.json().catch(() => undefined);

  if (!body || typeof body !== "object") {
    return Response.json({ reason: "제작 요청이 올바르지 않아요." }, { status: 400 });
  }

  const productType = body.productType === "signage" ? "signage" : body.productType === "flyer" ? "flyer" : "banner";
  const layout = body.layout && typeof body.layout === "object" ? body.layout : {};
  const widthMm = Number.isFinite(layout.widthMm) ? layout.widthMm : productType === "signage" ? 2400 : productType === "flyer" ? 148 : 55;
  const heightMm = Number.isFinite(layout.heightMm) ? layout.heightMm : productType === "signage" ? 600 : productType === "flyer" ? 210 : 170;
  const backgroundColor = typeof layout.backgroundColor === "string" && /^#[0-9a-fA-F]{6}$/.test(layout.backgroundColor) ? layout.backgroundColor : "#ffffff";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const userRequest = typeof body.request === "string" ? body.request.trim() : "";
  const prompt = [
    promptBase(productType),
    `Canvas ratio reference: ${widthMm}mm x ${heightMm}mm artwork.`,
    `Selected background color: ${backgroundColor}.`,
    category ? `Brand category for visual mood only: ${category}.` : "Use a polished commercial visual mood.",
    userRequest ? `User background style request: ${userRequest}` : "",
    "The image should be one uninterrupted surface with smooth gradients, soft lighting, subtle texture, gentle depth, and abstract decoration.",
    "Keep the composition fluid and organic across the whole canvas. Avoid any structured advertising-design look.",
  ].filter(Boolean).join("\n");

  return Response.json({ prompt });
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

    if (url.pathname === "/api/ai-business-cards/layout-suggestion" || url.pathname === "/api/print-products/layout-suggestion" || url.pathname === "/api/print-products/drafts") {
      return proxyToMainWorker(request, env);
    }

    if (url.pathname === "/api/print-products/mockup-prompt") {
      return buildPrintProductPromptResponse(request);
    }

    if (!shouldUseNativeContainer(url.pathname)) {
      return proxyToMainWorker(request, env);
    }

    const container = env.PRINTY_CONTAINER.getByName("printy-main-v83");
    await container.startAndWaitForPorts(3000, {
      instanceGetTimeoutMS: 30_000,
      portReadyTimeoutMS: 90_000,
      waitInterval: 1_000,
    });
    return container.fetch(request);
  },
};
