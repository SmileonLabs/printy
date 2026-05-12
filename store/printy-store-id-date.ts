export function makeId(prefix: string, existingCount: number) {
  return `${prefix}-${Date.now()}-${existingCount + 1}`;
}

export function getCreatedDate() {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getDisplayDate() {
  return `${getCreatedDate()} 주문`;
}
