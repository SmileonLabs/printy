"use client";

import { useEffect } from "react";
import type { LoginRedirectTarget } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

type SessionApiResponse = {
  authenticated: boolean;
  session?: {
    user?: {
      id?: string;
      name?: string;
      contact?: string;
    };
    authenticatedAt?: string;
  };
};

function isSessionApiResponse(value: unknown): value is SessionApiResponse {
  return typeof value === "object" && value !== null && "authenticated" in value && typeof value.authenticated === "boolean";
}

function readRedirectTarget() {
  const params = new URLSearchParams(window.location.search);

  return params.get("target") === "checkout" ? "checkout" : "dashboard";
}

function clearAuthQuery() {
  const url = new URL(window.location.href);

  if (!url.searchParams.has("auth")) {
    return;
  }

  url.searchParams.delete("auth");
  url.searchParams.delete("target");
  window.history.replaceState({}, "", url);
}

function hasAuthQuery() {
  return new URLSearchParams(window.location.search).has("auth");
}

export function SessionSyncController() {
  const login = usePrintyStore((state) => state.login);

  useEffect(() => {
    let isActive = true;

    async function syncSession() {
      const response = await fetch("/api/session", { cache: "no-store" }).catch(() => undefined);

      if (!response?.ok) {
        clearAuthQuery();
        return;
      }

      const payload: unknown = await response.json().catch(() => undefined);

      if (!isActive || !isSessionApiResponse(payload) || !payload.authenticated || !payload.session?.user?.id || !payload.session.user.name || !payload.session.user.contact) {
        clearAuthQuery();
        return;
      }

      const redirectTarget: LoginRedirectTarget = readRedirectTarget();
      const state = usePrintyStore.getState();

      if (!hasAuthQuery() && state.isAuthenticated && state.authSession?.userId === payload.session.user.id) {
        clearAuthQuery();
        return;
      }

      login({ id: payload.session.user.id, name: payload.session.user.name, contact: payload.session.user.contact, authenticatedAt: payload.session.authenticatedAt }, redirectTarget);
      clearAuthQuery();
    }

    void syncSession();

    return () => {
      isActive = false;
    };
  }, [login]);

  return null;
}
