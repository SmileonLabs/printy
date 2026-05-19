import { NextResponse } from "next/server";
import { isOrderStatus } from "@/lib/order-status";
import { isAdminRequestAuthenticated } from "@/lib/server/admin-auth";
import { listAdminOrders, updateAdminOrderStatus } from "@/lib/server/admin-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorizedResponse() {
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  return NextResponse.json({ orders: await listAdminOrders() });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function PATCH(request: Request) {
  if (!isAdminRequestAuthenticated(request)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => undefined);

  if (!isRecord(body) || typeof body.orderId !== "string" || !isOrderStatus(body.status)) {
    return NextResponse.json({ reason: "주문 상태 변경 요청이 올바르지 않아요." }, { status: 400 });
  }

  const order = await updateAdminOrderStatus(body.orderId, body.status);

  if (!order) {
    return NextResponse.json({ reason: "주문을 찾지 못했어요." }, { status: 404 });
  }

  return NextResponse.json({ order });
}
