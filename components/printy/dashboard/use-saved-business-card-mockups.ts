"use client";

import { useEffect, useState } from "react";
import type { AiBusinessCardMockup, Member } from "@/lib/types";

type BusinessCardMockupSignatureEntry = {
  member: Member;
  logoId: string;
  signature: string;
};

function hasCompleteAiBusinessCardMockup(mockup: AiBusinessCardMockup) {
  return Boolean(mockup.imageUrl && mockup.cleanImageUrl);
}

function createSavedMockupSearchParams(signature: string | undefined, input: { brandName: string; logoId?: string; memberName: string; memberPhone: string }) {
  const params = new URLSearchParams();

  if (signature?.trim()) {
    params.set("signature", signature.trim());
  }
  if (input.brandName.trim()) {
    params.set("brandName", input.brandName.trim());
  }
  if (input.logoId?.trim()) {
    params.set("logoId", input.logoId.trim());
  }
  if (input.memberName.trim()) {
    params.set("memberName", input.memberName.trim());
  }
  if (input.memberPhone.trim()) {
    params.set("memberPhone", input.memberPhone.trim());
  }

  return params;
}

export function useSavedBusinessCardMockups(input: { isAuthenticated: boolean; authUserId?: string; brandId: string; brandName: string; entries: BusinessCardMockupSignatureEntry[] }) {
  const [loadedKey, setLoadedKey] = useState("");
  const [loadedMockups, setLoadedMockups] = useState<{ signature: string; mockups: AiBusinessCardMockup[] }>();

  useEffect(() => {
    if (!input.isAuthenticated || !input.authUserId) {
      return;
    }

    const loadKey = `${input.authUserId}:${input.brandId}:${input.brandName}:${input.entries.map((entry) => `${entry.logoId}:${entry.member.id}:${entry.member.name}:${entry.member.phone}`).join("|")}`;

    if (loadedKey === loadKey) {
      return;
    }

    setLoadedKey(loadKey);
    setLoadedMockups(undefined);
    let isActive = true;

    async function loadServerMockups() {
      for (const entry of input.entries) {
        const params = createSavedMockupSearchParams(entry.signature, { brandName: input.brandName, logoId: entry.logoId, memberName: entry.member.name, memberPhone: entry.member.phone });
        const response = await fetch(`/api/ai-business-cards/mockups/saved?${params.toString()}`, { cache: "no-store" }).catch(() => undefined);

        if (!response?.ok || !isActive) {
          continue;
        }

        const data = await response.json() as { mockups?: AiBusinessCardMockup[]; signature?: string };
        const serverMockups = Array.isArray(data.mockups) ? data.mockups.filter(hasCompleteAiBusinessCardMockup) : [];

        if (serverMockups.length > 0) {
          setLoadedMockups({ signature: data.signature ?? entry.signature, mockups: serverMockups });
          return;
        }
      }

      const fallbackLogoIds = Array.from(new Set(input.entries.map((entry) => entry.logoId)));
      const fallbackSignature = input.entries[0]?.signature;

      for (const logoId of fallbackLogoIds) {
        if (!fallbackSignature) {
          return;
        }

        const params = createSavedMockupSearchParams(fallbackSignature, { brandName: input.brandName, logoId, memberName: "", memberPhone: "" });
        const response = await fetch(`/api/ai-business-cards/mockups/saved?${params.toString()}`, { cache: "no-store" }).catch(() => undefined);

        if (!response?.ok || !isActive) {
          continue;
        }

        const data = await response.json() as { mockups?: AiBusinessCardMockup[]; signature?: string };
        const serverMockups = Array.isArray(data.mockups) ? data.mockups.filter(hasCompleteAiBusinessCardMockup) : [];

        if (serverMockups.length > 0) {
          setLoadedMockups({ signature: data.signature ?? fallbackSignature, mockups: serverMockups });
          return;
        }
      }

      const params = createSavedMockupSearchParams(fallbackSignature, { brandName: input.brandName, logoId: "", memberName: "", memberPhone: "" });
      const response = await fetch(`/api/ai-business-cards/mockups/saved?${params.toString()}`, { cache: "no-store" }).catch(() => undefined);

      if (!response?.ok || !isActive) {
        return;
      }

      const data = await response.json() as { mockups?: AiBusinessCardMockup[]; signature?: string };
      const serverMockups = Array.isArray(data.mockups) ? data.mockups.filter(hasCompleteAiBusinessCardMockup) : [];

      if (serverMockups.length > 0 && data.signature) {
        setLoadedMockups({ signature: data.signature, mockups: serverMockups });
      }
    }

    void loadServerMockups();

    return () => {
      isActive = false;
    };
  }, [input.authUserId, input.brandId, input.brandName, input.entries, input.isAuthenticated, loadedKey]);

  return loadedMockups;
}
