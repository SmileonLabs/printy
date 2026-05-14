"use client";

import { useEffect, useRef } from "react";
import { createBrandWorkspaceSignature, hasBrandWorkspaceData, mergeBrandWorkspaces, readBrandWorkspace, type BrandWorkspace } from "@/lib/brand-workspace";
import { usePrintyStore } from "@/store/use-printy-store";

function readLocalWorkspace(): BrandWorkspace {
  const state = usePrintyStore.getState();

  return {
    brands: state.brands,
    brandAssets: state.brandAssets,
    savedGeneratedLogoOptions: state.savedGeneratedLogoOptions,
    businessCardDrafts: state.businessCardDrafts,
    orders: state.orders,
  };
}

async function fetchBrandWorkspace() {
  const response = await fetch("/api/brand-workspace", { cache: "no-store" });

  if (response.status === 401) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error("Brand workspace fetch failed.");
  }

  const workspace = readBrandWorkspace(await response.json());

  if (!workspace) {
    throw new Error("Brand workspace fetch returned invalid data.");
  }

  return workspace;
}

async function saveBrandWorkspace(workspace: BrandWorkspace) {
  const response = await fetch("/api/brand-workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workspace),
  });

  if (!response.ok) {
    throw new Error("Brand workspace save failed.");
  }

  const savedWorkspace = readBrandWorkspace(await response.json());

  if (!savedWorkspace) {
    throw new Error("Brand workspace save returned invalid data.");
  }

  return savedWorkspace;
}

export function BrandWorkspaceSyncController() {
  const isAuthenticated = usePrintyStore((state) => state.isAuthenticated);
  const userId = usePrintyStore((state) => state.authSession?.userId);
  const brands = usePrintyStore((state) => state.brands);
  const brandAssets = usePrintyStore((state) => state.brandAssets);
  const savedGeneratedLogoOptions = usePrintyStore((state) => state.savedGeneratedLogoOptions);
  const businessCardDrafts = usePrintyStore((state) => state.businessCardDrafts);
  const orders = usePrintyStore((state) => state.orders);
  const brandWorkspaceOwnerUserId = usePrintyStore((state) => state.brandWorkspaceOwnerUserId);
  const syncBrandWorkspace = usePrintyStore((state) => state.syncBrandWorkspace);
  const acknowledgeBrandWorkspaceSave = usePrintyStore((state) => state.acknowledgeBrandWorkspaceSave);
  const syncedUserIdsRef = useRef<Set<string>>(new Set());
  const initialSyncedUserIdsRef = useRef<Set<string>>(new Set());
  const savingUserIdsRef = useRef<Set<string>>(new Set());
  const lastSavedSignaturesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isAuthenticated || !userId || syncedUserIdsRef.current.has(userId)) {
      return;
    }

    let isActive = true;
    const syncedUserId = userId;
    syncedUserIdsRef.current.add(syncedUserId);

    async function syncAuthenticatedWorkspace() {
      try {
        const serverWorkspace = await fetchBrandWorkspace();

        if (!serverWorkspace || !isActive) {
          return;
        }

        const localWorkspace = readLocalWorkspace();
        const localWorkspaceHasData = hasBrandWorkspaceData(localWorkspace);
        const localWorkspaceBelongsToUser = brandWorkspaceOwnerUserId === syncedUserId;
        const canUploadLocalWorkspace = localWorkspaceBelongsToUser;
        const canonicalWorkspace = canUploadLocalWorkspace && localWorkspaceHasData ? await saveBrandWorkspace(mergeBrandWorkspaces(localWorkspace, serverWorkspace)) : serverWorkspace;

        if (isActive) {
          lastSavedSignaturesRef.current.set(syncedUserId, createBrandWorkspaceSignature(canonicalWorkspace));
          initialSyncedUserIdsRef.current.add(syncedUserId);
          syncBrandWorkspace(canonicalWorkspace, syncedUserId);
        }
      } catch {
        if (isActive) {
          syncedUserIdsRef.current.delete(syncedUserId);
          initialSyncedUserIdsRef.current.delete(syncedUserId);
          lastSavedSignaturesRef.current.delete(syncedUserId);
        }
      }
    }

    void syncAuthenticatedWorkspace();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, userId, brandWorkspaceOwnerUserId, syncBrandWorkspace]);

  useEffect(() => {
    if (!isAuthenticated || !userId || !initialSyncedUserIdsRef.current.has(userId) || savingUserIdsRef.current.has(userId)) {
      return;
    }

    const initialWorkspace = { brands, brandAssets, savedGeneratedLogoOptions, businessCardDrafts, orders };
    const initialSignature = createBrandWorkspaceSignature(initialWorkspace);

    if (lastSavedSignaturesRef.current.get(userId) === initialSignature) {
      return;
    }

    const autosaveUserId = userId;
    savingUserIdsRef.current.add(autosaveUserId);

    async function autosaveWorkspaceChanges() {
      let workspaceToSave = initialWorkspace;
      let signatureToSave = initialSignature;

      while (lastSavedSignaturesRef.current.get(autosaveUserId) !== signatureToSave) {
        try {
          await saveBrandWorkspace(workspaceToSave);
        } catch {
          return;
        }

        const currentWorkspace = readLocalWorkspace();
        const currentSignature = createBrandWorkspaceSignature(currentWorkspace);
        acknowledgeBrandWorkspaceSave(signatureToSave, autosaveUserId);
        lastSavedSignaturesRef.current.set(autosaveUserId, signatureToSave);

        if (currentSignature === signatureToSave) {
          return;
        }

        workspaceToSave = currentWorkspace;
        signatureToSave = currentSignature;
      }
    }

    void autosaveWorkspaceChanges().finally(() => {
      savingUserIdsRef.current.delete(autosaveUserId);
    });
  }, [isAuthenticated, userId, brands, brandAssets, savedGeneratedLogoOptions, businessCardDrafts, orders, acknowledgeBrandWorkspaceSave]);

  return null;
}
