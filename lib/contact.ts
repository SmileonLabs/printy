export function normalizeContact(contact: string) {
  const trimmed = contact.trim().toLowerCase();

  return trimmed.includes("@") ? trimmed.replace(/\s+/g, "") : trimmed.replace(/[^0-9+]/g, "");
}
