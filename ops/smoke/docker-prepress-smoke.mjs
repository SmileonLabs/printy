const baseUrl = (process.env.PRINTY_SMOKE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const adminContact = process.env.PRINTY_SMOKE_ADMIN_CONTACT ?? "";
const adminToken = process.env.PRINTY_SMOKE_ADMIN_TOKEN ?? "";
const expectFailClosed = process.env.PRINTY_SMOKE_EXPECT_FAIL_CLOSED === "1";

const fields = [
  ["role", true, 10, 10, 40, 8, "regular"],
  ["name", true, 10, 20, 40, 8, "bold"],
  ["phone", true, 10, 30, 40, 8, "regular"],
  ["email", true, 10, 40, 40, 8, "regular"],
  ["address", false, 10, 50, 40, 8, "regular"],
  ["mainPhone", false, 10, 60, 40, 8, "regular"],
  ["fax", false, 10, 70, 40, 8, "regular"],
].map(([id, visible, x, y, width, height, fontWeight]) => ({
  id,
  visible,
  box: { x, y, width, height },
  fontFamily: "sans",
  fontSize: 10,
  color: "#111827",
  fontWeight,
  italic: false,
}));

function fail(message) {
  throw new Error(message);
}

function log(message) {
  console.log(`[printy-smoke] ${message}`);
}

function requireEnv(name, value) {
  if (!value.trim()) {
    fail(`${name} is required. Set it explicitly for the smoke run.`);
  }
}

function url(path) {
  return `${baseUrl}${path}`;
}

async function fetchRequired(path, options = {}) {
  const response = await fetch(url(path), options);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    fail(`${options.method ?? "GET"} ${path} returned ${response.status}. ${body}`.trim());
  }

  return response;
}

async function readJson(response, label) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    fail(`${label} did not return JSON. content-type=${contentType}`);
  }

  return response.json();
}

async function expectHtml(path) {
  const response = await fetchRequired(path);
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/html")) {
    fail(`${path} did not return HTML. content-type=${contentType}`);
  }

  log(`${path} returned HTML`);
}

async function login() {
  const response = await fetchRequired("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contact: adminContact, token: adminToken }),
  });
  const body = await readJson(response, "admin login");

  if (body.authenticated !== true) {
    fail("admin login did not authenticate");
  }

  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];

  if (!cookie.startsWith("printy-admin-session=")) {
    fail("admin login did not return a printy-admin-session cookie");
  }

  log("admin login succeeded");
  return cookie;
}

function templatePayload() {
  const createdAt = new Date().toISOString();

  return {
    title: `Docker Smoke Card ${createdAt}`,
    summary: "Docker prepress smoke template",
    tags: ["smoke", "docker"],
    orientation: "horizontal",
    previewVariant: "clean",
    status: "draft",
    layout: {
      canvas: {
        trim: { widthMm: 90, heightMm: 50 },
        edit: { x: 0, y: 0, width: 100, height: 100 },
        safe: { x: 3, y: 5, width: 94, height: 90 },
      },
      sides: {
        front: {
          logo: { visible: true, box: { x: 60, y: 20, width: 20, height: 20 } },
          fields,
          icons: [],
          background: { enabled: false },
        },
        back: {
          logo: { visible: false, box: { x: 40, y: 30, width: 20, height: 20 } },
          fields: fields.map((field) => ({ ...field, visible: false, box: { ...field.box } })),
          icons: [],
          background: { enabled: false },
        },
      },
    },
  };
}

async function createTemplate(cookie) {
  const response = await fetchRequired("/api/admin/templates", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(templatePayload()),
  });
  const body = await readJson(response, "template create");
  const templateId = body.template?.id;

  if (typeof templateId !== "string" || templateId.length === 0) {
    fail("template create did not return a template id");
  }

  log(`created temporary template ${templateId}`);
  return templateId;
}

async function deleteTemplate(cookie, templateId) {
  const response = await fetch(url(`/api/admin/templates/${encodeURIComponent(templateId)}`), {
    method: "DELETE",
    headers: { cookie },
  });

  if (response.ok) {
    log(`deleted temporary template ${templateId}`);
  } else {
    log(`template cleanup returned ${response.status} for ${templateId}`);
  }
}

async function logout(cookie) {
  await fetch(url("/api/admin/session"), { method: "DELETE", headers: { cookie } }).catch(() => undefined);
}

async function checkHelperPdf(cookie, templateId) {
  const response = await fetchRequired(`/api/admin/templates/${encodeURIComponent(templateId)}/print-shop-pdf`, {
    headers: { cookie },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const renderer = response.headers.get("x-printy-pdf-renderer") ?? "";
  const bytes = await response.arrayBuffer();

  if (!contentType.includes("application/pdf")) {
    fail(`helper PDF did not return PDF. content-type=${contentType}`);
  }

  if (bytes.byteLength < 1000) {
    fail(`helper PDF was unexpectedly small: ${bytes.byteLength} bytes`);
  }

  if (renderer !== "chromium") {
    fail(`helper PDF renderer header was ${renderer || "missing"}, expected chromium`);
  }

  log(`helper PDF returned ${bytes.byteLength} bytes`);
}

async function checkDraftHelperPdf(cookie) {
  const response = await fetchRequired("/api/admin/templates/print-shop-pdf", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(templatePayload()),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const renderer = response.headers.get("x-printy-pdf-renderer") ?? "";
  const bytes = await response.arrayBuffer();

  if (!contentType.includes("application/pdf")) {
    fail(`draft helper PDF did not return PDF. content-type=${contentType}`);
  }

  if (bytes.byteLength < 1000) {
    fail(`draft helper PDF was unexpectedly small: ${bytes.byteLength} bytes`);
  }

  if (renderer !== "chromium") {
    fail(`draft helper PDF renderer header was ${renderer || "missing"}, expected chromium`);
  }

  log(`draft helper PDF returned ${bytes.byteLength} bytes`);
}

async function checkPrepress(cookie, templateId) {
  const response = await fetchRequired(`/api/admin/templates/${encodeURIComponent(templateId)}/print-shop-pdf?variant=prepress&check=1`, {
    headers: { cookie },
  });
  const body = await readJson(response, "prepress check");
  const status = body.status;
  const checks = Array.isArray(body.checks) ? body.checks : [];

  if (typeof status !== "string" || checks.length === 0) {
    fail("prepress check did not return a status with checks");
  }

  if (expectFailClosed) {
    if (status !== "validation-failed" || body.downloadable !== false) {
      fail(`expected fail-closed validation-failed, got status=${status} downloadable=${body.downloadable}`);
    }
  } else if (status !== "pdfx-candidate" && status !== "pdfx-validated") {
    fail(`expected pdfx-candidate or pdfx-validated, got ${status}`);
  }

  log(`prepress check status=${status} downloadable=${body.downloadable}`);
}

async function main() {
  requireEnv("PRINTY_SMOKE_ADMIN_CONTACT", adminContact);
  requireEnv("PRINTY_SMOKE_ADMIN_TOKEN", adminToken);

  let cookie = "";
  let templateId = "";

  try {
    await expectHtml("/");
    await expectHtml("/admin");

    const sessionResponse = await fetchRequired("/api/admin/session");
    const session = await readJson(sessionResponse, "anonymous admin session");

    if (session.authenticated !== false) {
      fail("anonymous admin session should not be authenticated");
    }

    cookie = await login();
    await checkDraftHelperPdf(cookie);
    templateId = await createTemplate(cookie);
    await checkHelperPdf(cookie, templateId);
    await checkPrepress(cookie, templateId);

    log("Docker prepress smoke passed");
  } finally {
    if (cookie && templateId) {
      await deleteTemplate(cookie, templateId);
    }

    if (cookie) {
      await logout(cookie);
    }
  }
}

main().catch((error) => {
  console.error(`[printy-smoke] ${error.message}`);
  process.exitCode = 1;
});
