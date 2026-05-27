import { businessCardDraftToDesignProject } from "@/lib/design-projects/adapters/business-card";
import { printProductDraftToDesignProject } from "@/lib/design-projects/adapters/print-product";
import type { DesignProject } from "@/lib/design-projects/types";
import type { AiBusinessCardMockup, BusinessCardDraft, PrintProductDraft } from "@/lib/types";

export type LegacyDesignProjectInput = {
  brandId: string;
  businessCardDrafts: BusinessCardDraft[];
  printProductDrafts: PrintProductDraft[];
  aiBusinessCardMockups?: AiBusinessCardMockup[];
};

function projectTimestamp(project: DesignProject) {
  const updatedAt = new Date(project.updatedAt).getTime();
  const createdAt = new Date(project.createdAt).getTime();

  return Number.isFinite(updatedAt) ? updatedAt : Number.isFinite(createdAt) ? createdAt : 0;
}

export function buildLegacyDesignProjectsForBrand(input: LegacyDesignProjectInput) {
  const businessCardProjects = input.businessCardDrafts
    .filter((draft) => draft.brandId === input.brandId)
    .map((draft) => businessCardDraftToDesignProject(draft, input.aiBusinessCardMockups))
    .filter((project): project is DesignProject => project !== undefined);

  const printProductProjects = input.printProductDrafts
    .filter((draft) => draft.brandId === input.brandId)
    .map(printProductDraftToDesignProject);

  return [...businessCardProjects, ...printProductProjects]
    .sort((left, right) => projectTimestamp(right) - projectTimestamp(left));
}

export function countDesignProjectsByProduct(projects: DesignProject[]) {
  return projects.reduce<Record<string, number>>((counts, project) => {
    counts[project.productType] = (counts[project.productType] ?? 0) + 1;

    return counts;
  }, {});
}
