import { isGeneratedLogoPublicUrl, readGeneratedLogoBytesByPublicUrl } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GeneratedLogoRouteContext = {
  params: Promise<{ fileName: string }>;
};

export async function GET(request: Request, context: GeneratedLogoRouteContext) {
  const { fileName } = await context.params;
  const publicUrl = `/uploads/generated-logos/${fileName}`;

  if (!isGeneratedLogoPublicUrl(publicUrl)) {
    return new Response(null, { status: 404 });
  }

  const bytes = await readGeneratedLogoBytesByPublicUrl(publicUrl);

  if (!bytes) {
    return new Response(null, { status: 404 });
  }

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "image/png",
    },
  });
}
