import type { OrderOptions } from "@/lib/types";

export function getOrderPrice(options: OrderOptions) {
  const quantityPrice = options.quantity === "100" ? 29000 : options.quantity === "200" ? 49000 : 89000;
  const paperPrice = options.paper === "고급" ? 8000 : 0;

  return `${(quantityPrice + paperPrice).toLocaleString("ko-KR")}원`;
}

export function getOrderPriceAmount(options: OrderOptions) {
  const quantityPrice = options.quantity === "100" ? 29000 : options.quantity === "200" ? 49000 : 89000;
  const paperPrice = options.paper === "고급" ? 8000 : 0;

  return quantityPrice + paperPrice;
}

export function formatPrice(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function createOrderNumber(existingCount: number) {
  const date = new Date();
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const suffix = String((Date.now() + existingCount) % 10000).padStart(4, "0");

  return `PO-${year}${month}${day}-${suffix}`;
}
