"use client";

import { useEffect, useRef } from "react";
import { readBrandWorkspace } from "@/lib/brand-workspace";
import { usePrintyStore } from "@/store/use-printy-store";

function readClaimToken() {
  const token = new URLSearchParams(window.location.search).get("claimLogoShare")?.trim();

  return token && /^[A-Za-z0-9_-]{24,80}$/.test(token) ? token : undefined;
}

function clearClaimToken() {
  const url = new URL(window.location.href);

  if (!url.searchParams.has("claimLogoShare")) {
    return;
  }

  url.searchParams.delete("claimLogoShare");
  window.history.replaceState({}, "", url);
}

export function LogoShareClaimController() {
  const isAuthenticated = usePrintyStore((state) => state.isAuthenticated);
  const userId = usePrintyStore((state) => state.authSession?.userId);
  const setStep = usePrintyStore((state) => state.setStep);
  const syncBrandWorkspace = usePrintyStore((state) => state.syncBrandWorkspace);
  const claimingTokenRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const token = readClaimToken();

    if (!token) {
      return;
    }

    if (!isAuthenticated || !userId) {
      setStep("login", "dashboard");
      return;
    }

    if (claimingTokenRef.current === token) {
      return;
    }

    claimingTokenRef.current = token;

    async function claimLogoShare() {
      const claimResponse = await fetch(`/api/logo-shares/${token}`, { method: "POST" });

      if (!claimResponse.ok) {
        clearClaimToken();
        return;
      }

      const workspaceResponse = await fetch("/api/brand-workspace", { cache: "no-store" });
      const workspace = workspaceResponse.ok ? readBrandWorkspace(await workspaceResponse.json().catch(() => undefined)) : undefined;

      if (workspace) {
        syncBrandWorkspace(workspace, userId);
      }

      clearClaimToken();
    }

    void claimLogoShare().finally(() => {
      claimingTokenRef.current = undefined;
    });
  }, [isAuthenticated, userId, setStep, syncBrandWorkspace]);

  return null;
}
