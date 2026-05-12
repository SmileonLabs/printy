"use client";

import { useEffect } from "react";
import type { PrintTemplate } from "@/lib/types";
import { usePrintyStore } from "@/store/use-printy-store";

type PublicTemplatesResponse = {
  templates: PrintTemplate[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isPrintTemplate(value: unknown): value is PrintTemplate {
  if (!isRecord(value)) {
    return false;
  }

  const orientation = value.orientation;
  const status = value.status;
  const source = value.source;

  return (
    typeof value.id === "string" &&
    typeof value.productId === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    isStringArray(value.tags) &&
    typeof value.createdAt === "string" &&
    (orientation === undefined || orientation === "horizontal" || orientation === "vertical") &&
    (typeof value.previewVariant === "undefined" || typeof value.previewVariant === "string") &&
    (status === undefined || status === "draft" || status === "published") &&
    (source === undefined || source === "seed" || source === "admin") &&
    (typeof value.updatedAt === "undefined" || typeof value.updatedAt === "string")
  );
}

function readTemplatesResponse(value: unknown): PublicTemplatesResponse | undefined {
  if (!isRecord(value) || !Array.isArray(value.templates) || !value.templates.every(isPrintTemplate)) {
    return undefined;
  }

  return { templates: value.templates };
}

export function PublicTemplateSyncController() {
  const syncTemplates = usePrintyStore((state) => state.syncTemplates);
  const resetTemplatesToSeeds = usePrintyStore((state) => state.resetTemplatesToSeeds);

  useEffect(() => {
    let isActive = true;

    async function syncPublicTemplates() {
      try {
        const response = await fetch("/api/templates", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Template sync failed.");
        }

        const data = readTemplatesResponse(await response.json());

        if (!data) {
          throw new Error("Template sync returned invalid data.");
        }

        if (isActive) {
          syncTemplates(data.templates);
        }
      } catch {
        if (isActive) {
          resetTemplatesToSeeds();
        }
      }
    }

    void syncPublicTemplates();

    return () => {
      isActive = false;
    };
  }, [syncTemplates, resetTemplatesToSeeds]);

  return null;
}
