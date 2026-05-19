import "server-only";

import { isOrderRecord } from "@/lib/brand-workspace";
import { isOrderStatus, orderStatusLabel } from "@/lib/order-status";
import type { OrderRecord, OrderStatus } from "@/lib/types";
import { withDbClient } from "@/lib/server/db";

export type AdminOrderSummary = {
  order: OrderRecord;
  user: {
    id: string;
    name: string;
    contact: string;
    email: string;
  };
  brandName: string;
  templateTitle: string;
  memberName: string;
  updatedAt: string;
};

type AdminOrderRow = {
  payload: unknown;
  updated_at: Date;
  user_id: string;
  user_name: string;
  user_contact: string | null;
  user_email: string | null;
  brand_name: string | null;
  template_title: string | null;
  draft_payload: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readDraftMemberName(value: unknown) {
  if (!isRecord(value) || !isRecord(value.member)) {
    return "-";
  }

  return typeof value.member.name === "string" && value.member.name.trim().length > 0 ? value.member.name.trim() : "-";
}

export async function listAdminOrders(): Promise<AdminOrderSummary[]> {
  return withDbClient(async (client) => {
    const result = await client.query<AdminOrderRow>(
      `
        select
          orders.payload,
          orders.updated_at,
          users.id::text as user_id,
          users.name as user_name,
          users.contact as user_contact,
          users.email as user_email,
          brands.name as brand_name,
          business_card_templates.title as template_title,
          business_card_drafts.payload as draft_payload
        from orders
        join users on users.id = orders.user_id
        left join brands on brands.user_id = orders.user_id and brands.id = orders.brand_id
        left join business_card_templates on business_card_templates.id = orders.template_id
        left join business_card_drafts on business_card_drafts.user_id = orders.user_id and business_card_drafts.id = orders.card_draft_id
        order by orders.updated_at desc, orders.created_at desc
        limit 200
      `,
    );

    return result.rows
      .map((row) => {
        if (!isOrderRecord(row.payload)) {
          return undefined;
        }

        return {
          order: row.payload,
          user: {
            id: row.user_id,
            name: row.user_name,
            contact: row.user_contact ?? "",
            email: row.user_email ?? "",
          },
          brandName: row.brand_name ?? "삭제된 브랜드",
          templateTitle: row.template_title ?? "기본 명함",
          memberName: readDraftMemberName(row.draft_payload),
          updatedAt: row.updated_at.toISOString(),
        };
      })
      .filter((order): order is AdminOrderSummary => order !== undefined);
  });
}

export async function updateAdminOrderStatus(orderId: string, status: OrderStatus): Promise<OrderRecord | undefined> {
  if (!orderId.trim() || !isOrderStatus(status)) {
    return undefined;
  }

  return withDbClient(async (client) => {
    const result = await client.query<{ payload: unknown }>("select payload from orders where id = $1 limit 1", [orderId]);
    const order = result.rows[0]?.payload;

    if (!isOrderRecord(order)) {
      return undefined;
    }

    const nextOrder: OrderRecord = {
      ...order,
      status,
      statusLabel: orderStatusLabel(status),
    };

    await client.query("update orders set payload = $2::jsonb, updated_at = now() where id = $1", [orderId, JSON.stringify(nextOrder)]);

    return nextOrder;
  });
}
