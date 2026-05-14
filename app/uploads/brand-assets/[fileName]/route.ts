import { isBrandAssetPublicUrl, readBrandAssetBytesByPublicUrl } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BrandAssetRouteContext = {
  params: Promise<{ fileName: string }>;
};

export async function GET(_request: Request, context: BrandAssetRouteContext) {
  const { fileName } = await context.params;
  const publicUrl = `/uploads/brand-assets/${fileName}`;

  if (!isBrandAssetPublicUrl(publicUrl)) {
    return new Response(null, { status: 404 });
  }

  const bytes = await readBrandAssetBytesByPublicUrl(publicUrl);

  if (!bytes) {
    return new Response(null, { status: 404 });
  }

  const body = Buffer.from(bytes);

  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": body.byteLength.toString(),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
