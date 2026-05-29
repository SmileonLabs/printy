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
  phone: "phone number",
  mainPhone: "main phone",
  fax: "fax",
  email: "email",
  website: "website",
  address: "address",
  account: "account number",
  instagram: "instagram",
  qrCode: "QR code",
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
  const logo = side.logo.visible ? [`reserved logo slot for Printy renderer (${boxText(side.logo.box)}); leave this area clean and do not draw the logo in the AI mockup`] : [];
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

function hasPlacedLogo(input: AiBusinessCardInput, template: PrintTemplate | undefined) {
  const layout = input.productionOptions?.layout ?? template?.layout;

  return Boolean(layout?.sides.front.logo.visible || layout?.sides.back.logo.visible);
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
    selectedFields.has("instagram") ? contentLine("Instagram", input.member.instagram) : undefined,
    selectedFields.has("qrCode") ? contentLine("QR code image placeholder", input.member.qrCodeImageUrl ? "provided by user" : undefined) : undefined,
  ].filter((line): line is string => Boolean(line));

  return lines.length > 0 ? lines.join("\n") : "- No editable customer text fields selected. Only place the representative logo/artwork and background design.";
}

function templateGuideText(input: AiBusinessCardInput, template: PrintTemplate | undefined) {
  if (!template?.layout) {
    return "No admin template layout was provided; use selected elements only.";
  }

  return `${template.title}\n- ${templateSideGuide(input, template, "front")}\n- ${templateSideGuide(input, template, "back")}`;
}

export type AiBusinessCardPromptOverrides = {
  mockupInstructions?: string;
  cleanInstructions?: string;
};

function adminInstructionsText(value: string | undefined) {
  const instructions = compact(value);

  return instructions === "none" ? "- None." : `- ${instructions}`;
}

export function buildAiBusinessCardMockupPrompt(input: AiBusinessCardInput, conceptNumber: number, template?: PrintTemplate, overrides: AiBusinessCardPromptOverrides = {}) {
  const usesPlacedLogo = hasPlacedLogo(input, template);

  return `Create one premium Korean business card sheet for Printy: a vertical 92mm x 104mm image that is made by stacking two complete horizontal 92mm x 52mm business cards.

USER DESIGN REQUEST - HIGHEST PRIORITY STYLE DIRECTION:
- ${compact(input.mockupRequest)}
- Follow this request unless it conflicts with logo preservation, exact user text rules, or the 92:52 card ratio.

ADMIN PROMPT INSTRUCTIONS:
${adminInstructionsText(overrides.mockupInstructions)}
- Follow these admin instructions unless they conflict with the strict image, logo, text accuracy, or layout rules below.

STRICT IMAGE RULES:
- This is only a visual design reference, not the final print file.
- The output image must be one portrait/vertical composite sheet with overall physical size 92mm wide x 104mm tall.
- The 92mm x 104mm sheet is not a single tall business card. It is only a preview container that holds two separate complete business cards stacked vertically.
- Treat the top half as one full, independent horizontal 92mm x 52mm business card front.
- Treat the bottom half as one full, independent horizontal 92mm x 52mm business card back.
- The front card and the back card are two complete cards with full 92mm x 52mm layouts. Do not design one tall card and cut it in half.
- The provided guide image is the required 92:104 vertical canvas. Replace the two blank halves with finished artwork; do not collapse the result into a single 92mm x 52mm card.
- The top 92mm x 52mm card must fill the full top half. The bottom 92mm x 52mm card must fill the full bottom half.
- Each side's exact horizontal business card artwork size is 92mm x 52mm. This 92mm x 52mm size already includes the cutting margin; do not add extra bleed.
- Each card must be a wide horizontal landscape card. Never create tall/narrow card artwork inside either half.
- Both panels must fill the full sheet width and exactly half of the sheet height. Do not add margins, extra canvas, padding, gutters, or whitespace around either panel.
- The final image must show both stacked halves at once: top front and bottom back. Never output only the front side, only the back side, or one enlarged single card.
- The visible rectangle ratio for each side must be exactly 92:52. Do not use square cards, A-series paper, posters, or perspective mockups.
- The front and back panels must have the same visible width and the same visible height. The back side must never be shorter, thinner, cropped, or a different ratio.
- Do not draw crop lines, guide outlines, borders, registration marks, separator rules, or any external frame around the two panels.
- Design must extend to the full edge of each panel with no artificial white margin unless it is an intentional full-bleed white background.
- Generate exactly one front design and exactly one back design in the same image.
- Front-facing, flat, orthographic view only.
- No perspective, no 3D mockup, no hands, no desk, no shadows, no angled view.
- Keep cards perfectly rectangular and unwarped.
- MANDATORY LOGO RULE: ${usesPlacedLogo ? "the layout contains an explicit Printy logo slot, so do not draw, paint, trace, duplicate, watermark, or embed the representative logo anywhere in the AI background/mockup. Leave the reserved logo slot clean; Printy will place the real logo as a separate vector/PNG element later." : "if a source logo image is provided, use that exact representative logo as-is."}
- Do not reinterpret, redraw, restyle, simplify, recolor, retypograph, or invent a new logo.
- ${usesPlacedLogo ? "Do not place the source logo in the generated mockup image at all." : "You may only place, scale, crop-safe fit, or visually composite the provided representative logo onto the card design."}
- ${usesPlacedLogo ? "The representative logo will appear only through Printy's renderer after background generation." : "The representative logo must appear on the business card design. Do not replace it with text or a similar symbol."}
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
- User mockup design request: ${compact(input.mockupRequest)}
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
- Do not invent, paraphrase, translate, or autocomplete any customer text.
- If a selected title or advertising field is listed as none, keep that area visually blank or decorative only. Never write your own slogans, promotions, offers, descriptors, or advertising copy.
- The word advertising only describes the field type; it is not permission to create ad copy.
- The final PDF will use these template coordinates, so the mockup should visually match them.
${templateGuideText(input, template)}

CONTENT TO PLACE:
${selectedContentText(input)}

TEXT ACCURACY RULES:
- Use only the exact non-none text values listed above.
- Do not add placeholder text such as sample names, made-up phone numbers, fake addresses, taglines, promotion copy, or brand claims.
- For QR code, render only a QR-like image area if the user provided a QR image; do not invent a URL or QR content.

Concept variation number: ${conceptNumber}. Make it visually distinct from other possible concepts.`;
}

export function buildAiBusinessCardCleanBackgroundPrompt(conceptNumber: number, overrides: AiBusinessCardPromptOverrides = {}) {
  return `Edit the provided completed Printy Korean business-card mockup into a CLEAN BACKGROUND companion image.

ADMIN CLEANUP INSTRUCTIONS:
${adminInstructionsText(overrides.cleanInstructions)}
- Follow these admin cleanup instructions unless they conflict with the strict clean background rules below.

STRICT CLEAN BACKGROUND RULES:
- Treat the provided image as the locked source mockup.
- Do not generate a new business card. Do not redesign, repaint, recompose, restyle, recolor, or reinterpret the source image.
- Perform a high-fidelity cleanup edit only: preserve the source image composition, card positions, card sizes, logo placement, decorative background, colors, and style as exactly as possible.
- Keep exactly one flat front design and exactly one flat back design on the same 92mm x 104mm vertical sheet.
- The sheet is split horizontally into exactly two equal 92mm x 52mm panels: top half front, bottom half back.
- Keep the required two-panel sheet structure, but separate the two halves by placement only, not by drawn lines.
- The boundary between the top and bottom panels must be invisible and filled with the same surrounding background texture/color.
- Keep the front and back panels the exact same visible size as the source image. The back side must not become shorter, thinner, cropped, or a different ratio.
- Remove all customer-entered field text glyphs: name, role, phone, main phone, fax, email, website, address, account number, Instagram, title lines, advertising lines, and QR code artwork.
- Also remove QR code artwork. Keep field icons, bullets, dividers, and markers if they are part of the selected design.
- Fill only the removed text/QR pixels with the immediately surrounding background texture/color. Do not modify other pixels.
- If a QR code or QR-like square is removed, leave that area as clean empty background only. Never replace the removed QR area with a logo, logo fragment, icon, symbol, decorative square, pattern, text, or any new artwork.
- Do not move, copy, enlarge, duplicate, or add the representative logo into any removed field area. The logo may remain only where it already existed in the source mockup.
- Do not remove or alter any text that is part of the representative logo image. Logo lettering must remain exactly as-is.
- Do not remove or alter brand lettering that is visually embedded inside the logo mark or logo lockup.
- Preserve field icons, bullets, dividers, and field markers unless they are embedded inside customer-entered text or QR artwork.
- Do not erase logo marks, decorative shapes, borders, background patterns, or non-field artwork.
- Do not draw crop lines, guide outlines, borders, registration marks, separator rules, neon green lines, external frames, visible horizontal divider lines, strokes, bevels, shadow edges, white lines, or black lines around or between the two panels.
- The clean background must extend to the full edge of each panel with no artificial white margin unless it is an intentional full-bleed white background.
- Keep both card sides front-facing, flat, unwarped, and ratio 92:52.
- No perspective, no 3D mockup, no hands, no desk, no angled view.

Concept variation number: ${conceptNumber}.`;
}
