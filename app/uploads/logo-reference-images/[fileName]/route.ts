import { NextResponse } from "next/server";
import { readLogoReferenceImageBytesByFileName } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ fileName: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { fileName } = await context.params;
  const image = await readLogoReferenceImageBytesByFileName(fileName);

  if (!image) {
    return NextResponse.json({ reason: "Reference image not found." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(image.bytes), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
