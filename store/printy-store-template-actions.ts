import type { PrintTemplate } from "@/lib/types";
import type { PrintyState } from "@/store/printy-store-types";
import type { StateCreator } from "zustand";

export function createPrintyTemplateActions(set: Parameters<StateCreator<PrintyState>>[0]) {
  return {
    syncTemplates: (templates: PrintTemplate[]) => set({ templates }),
    resetTemplatesToSeeds: () => set({ templates: [] }),
  };
}
