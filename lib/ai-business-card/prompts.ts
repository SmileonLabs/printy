import type { AiBusinessCardInput } from "@/lib/ai-business-card/schema";
import { buildAiBusinessCardIconPromptGuide } from "@/lib/ai-business-card/icons";
import type { BusinessCardTemplateBox, BusinessCardTemplateSideId, BusinessCardUserElementId, PrintTemplate } from "@/lib/types";

function compact(value: string | undefined) {
  return value?.trim() || "없음";
}

const elementLabels: Record<string, string> = {
  logo: "representative logo",
  brandName: "brand name as logo/artwork only",
  category: "category as artwork only",
  name: "name",
  role: "role",
  phone: "mobile phone",
  mainPhone: "main phone",
  fax: "fax",
  email: "email",
  website: "website",
  address: "address",
  account: "account number",
};

const toneLabels: Record<string, string> = {
  black: "black / charcoal",
  white: "white / light neutral",
  green: "green",
  yellow: "yellow",
  blue: "blue",
  red: "red",
};

function selectedElementsText(values: string[] | undefined) {
  return values && values.length > 0 ? values.map((value) => elementLabels[value] ?? value).join(", ") : "none selected";
}

const iconFieldIds: Record<string, BusinessCardUserElementId | undefined> = {
  mobile: "phone",
  phone: "mainPhone",
  email: "email",
  location: "address",
  address: "address",
  fax: "fax",
  web: "website",
  account: "account",
};

function boxText(box: BusinessCardTemplateBox) {
  return `x ${box.x.toFixed(1)}%, y ${box.y.toFixed(1)}%, w ${box.width.toFixed(1)}%, h ${box.height.toFixed(1)}%`;
}

function templateSideGuide(input: AiBusinessCardInput, template: PrintTemplate, sideId: BusinessCardTemplateSideId) {
  const side = template.layout?.sides[sideId];
  const selectedElements = sideId === "front" ? input.productionOptions?.frontElements : input.productionOptions?.backElements;

  if (!side) {
    return `${sideId}: no saved layout`;
  }

  const wantsElement = (elementId: BusinessCardUserElementId) => !selectedElements || selectedElements.includes(elementId);
  const logo = side.logo.visible && (wantsElement("logo") || wantsElement("brandName") || wantsElement("category")) ? [`representative logo artwork (${boxText(side.logo.box)})`] : [];
  const fields = side.fields
    .filter((field) => field.visible && wantsElement(field.id))
    .map((field) => `${elementLabels[field.id] ?? field.id} text: ${boxText(field.box)}, font ${field.fontSize}px, ${field.fontWeight}, ${field.align}`);
  const icons = side.icons
    .filter((icon) => {
      const fieldId = iconFieldIds[icon.icon];

      return icon.visible && icon.icon !== "name" && icon.icon !== "role" && (!fieldId || wantsElement(fieldId));
    })
    .map((icon) => `${icon.icon} icon: ${boxText(icon.box)}`);

  return `${sideId}: ${[...logo, ...fields, ...icons].join("; ") || "no visible elements"}`;
}

function contentLine(label: string, value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? `- ${label}: ${trimmedValue}` : `- ${label}: none`;
}

function selectedContentText(input: AiBusinessCardInput) {
  const selectedFields = new Set([...(input.productionOptions?.frontElements ?? []), ...(input.productionOptions?.backElements ?? [])]);
  const lines = [
    selectedFields.has("name") ? contentLine("Name text only, no marker or icon", input.member.name) : undefined,
    selectedFields.has("role") ? contentLine("Role text only, no marker or icon", input.member.role) : undefined,
    selectedFields.has("phone") ? contentLine("Phone", input.member.phone) : undefined,
    selectedFields.has("mainPhone") ? contentLine("Main phone", input.member.mainPhone) : undefined,
    selectedFields.has("fax") ? contentLine("Fax", input.member.fax) : undefined,
    selectedFields.has("email") ? contentLine("Email", input.member.email) : undefined,
    selectedFields.has("website") ? contentLine("Website", input.member.website) : undefined,
    selectedFields.has("address") ? contentLine("Address", input.member.address) : undefined,
    selectedFields.has("account") ? contentLine("Account", input.member.account) : undefined,
  ].filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join("\n") : "- No editable customer text fields selected. Only place the representative logo/artwork and background design.";
}

function templateGuideText(input: AiBusinessCardInput, template: PrintTemplate | undefined) {
  if (!template?.layout) {
    return "No admin template layout was provided; use selected elements only.";
  }

  return `${template.title}\n- ${templateSideGuide(input, template, "front")}\n- ${templateSideGuide(input, template, "back")}`;
}

export function buildAiBusinessCardMockupPrompt(input: AiBusinessCardInput, conceptNumber: number, template?: PrintTemplate) {
  return `Create one premium two-sided Korean business card design concept for Printy.

STRICT IMAGE RULES:
- This is only a visual design reference, not the final print file.
- Exact horizontal business card artwork size: 92mm x 52mm for each side. This 92mm x 52mm size already includes the cutting margin; do not add extra bleed.
- Use the provided transparent guide image only as the required sheet aspect ratio. The whole design sheet represents 92mm x 104mm.
- Split the sheet horizontally into exactly two equal 92mm x 52mm panels: top half is the front, bottom half is the back.
- Both panels must fill the full sheet width and exactly half of the sheet height. Do not add margins, extra canvas, padding, gutters, or whitespace around either panel.
- The visible rectangle ratio for each side must be exactly 92:52. Do not use square cards, A-series paper, posters, or perspective mockups.
- The front and back panels must have the same visible width and the same visible height. The back side must never be shorter, thinner, cropped, or a different ratio.
- Do not draw crop lines, guide outlines, borders, registration marks, separator rules, or any external frame around the two panels.
- Design must extend to the full edge of each panel with no artificial white margin unless it is an intentional full-bleed white background.
- Generate exactly one front design and exactly one back design in the same image.
- Front-facing, flat, orthographic view only.
- No perspective, no 3D mockup, no hands, no desk, no shadows, no angled view.
- Keep cards perfectly rectangular and unwarped.
- MANDATORY LOGO RULE: if a source logo image is provided, use that exact representative logo as-is.
- Do not reinterpret, redraw, restyle, simplify, recolor, retypograph, or invent a new logo.
- You may only place, scale, crop-safe fit, or visually composite the provided representative logo onto the card design.
- The representative logo must appear on the business card design. Do not replace it with text or a similar symbol.
- Do not typeset the brand name or category as separate editable text outside the provided logo. Logo lettering belongs to the logo artwork only.
- Design for a future vector PDF renderer: text, lines, icons, QR, and shapes must be visually separable.
 - Use the canonical Printy field icons below only for contact fields, and keep each icon immediately next to its matching text field.
 - Name and role are text-only fields. Do not add icons, pictograms, vertical bars, markers, bullets, badges, or divider lines next to the name or role.
 - Never create a person, user, profile, avatar, head, shoulders, badge, ID-card, or human icon for the name or role field.

CANONICAL FIELD ICONS:
${buildAiBusinessCardIconPromptGuide()}

BRAND:
- Brand name: ${compact(input.brandName)}
- Category: ${compact(input.category)}
- Mood: ${compact(input.mood)}
- Preferred colors: ${compact(input.colors)}
- Reference style: ${compact(input.referenceStyle)}
- Front note: ${compact(input.frontNote)}
- Back note: ${compact(input.backNote)}
- Selected front elements: ${selectedElementsText(input.productionOptions?.frontElements)}
- Selected back elements: ${selectedElementsText(input.productionOptions?.backElements)}
- Preferred design tone: ${input.productionOptions ? toneLabels[input.productionOptions.color] ?? input.productionOptions.color : "use template/default tone"}
- Treat the preferred design tone as mood and accent guidance only. Do not force a flat background color, and do not make the whole card simply black/white/green/yellow/blue/red because of this choice.

ADMIN TEMPLATE STRUCTURE TO FOLLOW EXACTLY:
- Use this saved admin template as the layout reference for composition and field placement.
- The selected information must appear on the exact same side as specified below: front items on the front only, back items on the back only.
- Place each selected information field at the same relative position and size as the template box below.
- Match the listed font size, weight, and alignment as closely as possible in the mockup image.
- Do not move selected fields to a different side, do not omit selected fields, and do not invent additional customer fields.
- The final PDF will use these template coordinates, so the mockup should visually match them.
${templateGuideText(input, template)}

CONTENT TO PLACE:
${selectedContentText(input)}

Concept variation number: ${conceptNumber}. Make it visually distinct from other possible concepts.`;
}

export function buildAiBusinessCardCleanBackgroundPrompt(conceptNumber: number) {
  return `Edit the provided completed Printy Korean business-card mockup into a CLEAN BACKGROUND companion image.

STRICT CLEAN BACKGROUND RULES:
- Treat the provided image as the locked source mockup.
- Do not generate a new business card. Do not redesign, repaint, recompose, restyle, recolor, or reinterpret the source image.
- Perform a high-fidelity cleanup edit only: preserve the source image composition, card positions, card sizes, logo placement, decorative background, colors, and style as exactly as possible.
- Keep exactly one flat front design and exactly one flat back design on the same 92mm x 104mm vertical sheet.
- The sheet is split horizontally into exactly two equal 92mm x 52mm panels: top half front, bottom half back.
- Keep the front and back panels the exact same visible size as the source image. The back side must not become shorter, thinner, cropped, or a different ratio.
- Remove all customer-entered field text glyphs: name, role, phone, main phone, fax, email, website, address, and account number.
- Also remove all field icons and markers next to those fields, including phone, mobile, email, fax, address/location, website, account, bullets, dividers, and any accidental name/role marker.
- Fill only the removed text/icon/marker pixels with the immediately surrounding background texture/color. Do not modify other pixels.
- Do not remove or alter any text that is part of the representative logo image. Logo lettering must remain exactly as-is.
- Do not remove or alter brand lettering that is visually embedded inside the logo mark or logo lockup.
- Do not preserve field icons, bullets, dividers, or field markers in the clean background. The final PDF renderer will redraw selected icons and text as vectors.
- Do not erase logo marks, decorative shapes, borders, background patterns, or non-field artwork.
- Do not draw crop lines, guide outlines, borders, registration marks, separator rules, neon green lines, or any external frame around the two panels.
- The clean background must extend to the full edge of each panel with no artificial white margin unless it is an intentional full-bleed white background.
- Keep both card sides front-facing, flat, unwarped, and ratio 92:52.
- No perspective, no 3D mockup, no hands, no desk, no angled view.

Concept variation number: ${conceptNumber}.`;
}
