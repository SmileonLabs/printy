import { businessCardTemplateIconArtwork } from "@/lib/business-card-templates";
import type { AiBusinessCardIconKind, AiBusinessCardTextField } from "@/lib/ai-business-card/schema";
import type { BusinessCardTemplateIconId } from "@/lib/types";

export type AiBusinessCardFieldIcon = {
  field: AiBusinessCardTextField;
  icon: AiBusinessCardIconKind;
  label: string;
  promptDescription: string;
};

type AiBusinessCardDecorativeIcon = {
  icon: Extract<AiBusinessCardIconKind, "projector" | "screen" | "speaker" | "led">;
  label: string;
  promptDescription: string;
};

export const aiBusinessCardFieldIcons: AiBusinessCardFieldIcon[] = [
  { field: "phone", icon: "mobile", label: "전화번호", promptDescription: "a simple mobile phone handset screen icon" },
  { field: "mainPhone", icon: "phone", label: "전화", promptDescription: "a simple landline telephone handset icon" },
  { field: "fax", icon: "fax", label: "팩스", promptDescription: "a simple fax/printer icon" },
  { field: "address", icon: "address", label: "주소", promptDescription: "a simple map pin location icon" },
  { field: "email", icon: "email", label: "이메일", promptDescription: "a simple envelope icon" },
  { field: "website", icon: "web", label: "웹도메인", promptDescription: "a simple globe web icon" },
  { field: "account", icon: "account", label: "계좌번호", promptDescription: "a simple bank card/account icon" },
  { field: "instagram", icon: "instagram", label: "인스타그램", promptDescription: "a simple Instagram camera outline icon" },
];

const aiBusinessCardDecorativeIcons: AiBusinessCardDecorativeIcon[] = [
  { icon: "projector", label: "빔프로젝트", promptDescription: "a simple video projector icon" },
  { icon: "screen", label: "스크린", promptDescription: "a simple projection screen icon" },
  { icon: "speaker", label: "스피커", promptDescription: "a simple speaker or sound system icon" },
  { icon: "led", label: "LED", promptDescription: "a simple LED display panel icon" },
];

export function businessCardTemplateIconIdForAi(icon: AiBusinessCardIconKind): BusinessCardTemplateIconId {
  if (icon === "address") {
    return "address";
  }
  if (icon === "company") {
    return "company";
  }

  return icon;
}

export function getAiBusinessCardIconArtwork(icon: AiBusinessCardIconKind) {
  return businessCardTemplateIconArtwork[businessCardTemplateIconIdForAi(icon)];
}

export function buildAiBusinessCardIconPromptGuide() {
  return [
    ...aiBusinessCardFieldIcons.map((item) => `- ${item.label}/${item.field}: use "${item.icon}" (${item.promptDescription}).`),
    ...aiBusinessCardDecorativeIcons.map((item) => `- ${item.label}: use "${item.icon}" only when the saved template includes this service/equipment icon (${item.promptDescription}).`),
  ].join("\n");
}
