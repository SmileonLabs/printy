import type { OrderStatus } from "@/lib/types";

export const orderStatusLabels: Record<OrderStatus, string> = {
  pendingDeposit: "입금 대기",
  paid: "주문 완료",
  preparing: "제작 준비중",
  cancelled: "주문 취소",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return value === "pendingDeposit" || value === "paid" || value === "preparing" || value === "cancelled";
}

export function orderStatusLabel(status: OrderStatus) {
  return orderStatusLabels[status];
}

export function isUserCancellableOrderStatus(status: OrderStatus) {
  return status === "pendingDeposit";
}
