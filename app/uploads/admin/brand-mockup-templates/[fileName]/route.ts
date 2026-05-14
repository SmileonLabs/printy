import { readAdminMockupTemplateBytesByFileName } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminMockupTemplateRouteContext = {
  params: Promise<{ fileName: string }>;
};

export async function GET(_request: Request, context: AdminMockupTemplateRouteContext) {
  const { fileName } = await context.params;
  const stored = await readAdminMockupTemplateBytesByFileName(fileName);

  if (!stored) {
    return new Response(null, { status: 404 });
  }

  const body = Buffer.from(stored.bytes);

  return new Response(body, {
    headers: {
      "Content-Type": stored.contentType,
      "Content-Length": body.byteLength.toString(),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
