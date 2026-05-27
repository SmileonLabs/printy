import { businessCardTemplateFieldIds, defaultBusinessCardTemplateLayout } from "@/lib/business-card-templates";
import type { BusinessCardProductionOptions, BusinessCardTemplateBox, BusinessCardTemplateLayout, BusinessCardTemplateSideId, BusinessCardTemplateTextFieldId, BusinessCardUserElementId } from "@/lib/types";

const contactFields: BusinessCardTemplateTextFieldId[] = ["name", "role", "phone", "mainPhone", "fax", "email", "website", "address", "account", "instagram"];

const fieldIconMap: Partial<Record<BusinessCardTemplateTextFieldId, "mobile" | "phone" | "fax" | "email" | "web" | "address" | "account" | "instagram">> = {
  phone: "mobile",
  mainPhone: "phone",
  fax: "fax",
  email: "email",
  website: "web",
  address: "address",
  account: "account",
  instagram: "instagram",
};

function cloneBox(box: BusinessCardTemplateBox): BusinessCardTemplateBox {
  return { ...box };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function containBox(box: BusinessCardTemplateBox): BusinessCardTemplateBox {
  const width = clamp(box.width, 1, 100);
  const height = clamp(box.height, 1, 100);

  return {
    x: clamp(box.x, 0, 100 - width),
    y: clamp(box.y, 0, 100 - height),
    width,
    height,
  };
}

function baseLayout(): BusinessCardTemplateLayout {
  return {
    canvas: {
      trim: { ...defaultBusinessCardTemplateLayout.canvas.trim },
      edit: { ...defaultBusinessCardTemplateLayout.canvas.edit },
      safe: { ...defaultBusinessCardTemplateLayout.canvas.safe },
    },
    sides: {
      front: {
        logo: { visible: true, box: { x: 8, y: 14, width: 28, height: 28 } },
        fields: defaultBusinessCardTemplateLayout.sides.front.fields.map((field) => ({ ...field, visible: false, box: cloneBox(field.box) })),
        icons: [],
        lines: [],
        background: { enabled: false },
      },
      back: {
        logo: { visible: false, box: { x: 36, y: 18, width: 28, height: 28 } },
        fields: defaultBusinessCardTemplateLayout.sides.back.fields.map((field) => ({ ...field, visible: false, box: cloneBox(field.box) })),
        icons: [],
        lines: [],
        background: { enabled: false },
      },
    },
  };
}

function fieldBox(fieldId: BusinessCardTemplateTextFieldId, index: number, total: number, sideId: BusinessCardTemplateSideId): BusinessCardTemplateBox {
  if (fieldId === "qrCode") {
    return containBox(sideId === "front" ? { x: 78, y: 66, width: 14, height: 24 } : { x: 76, y: 58, width: 16, height: 28 });
  }

  if (fieldId.startsWith("headline-") || fieldId.startsWith("body-")) {
    return containBox({ x: 10, y: 12 + index * 11, width: 80, height: 9 });
  }

  const startY = Math.max(16, 50 - Math.min(total, 8) * 4.5);

  return containBox({ x: sideId === "front" ? 48 : 12, y: startY + index * 9, width: sideId === "front" ? 42 : 70, height: 7.5 });
}

function selectedTextFields(elements: BusinessCardUserElementId[]): BusinessCardTemplateTextFieldId[] {
  return [...businessCardTemplateFieldIds.filter((fieldId) => elements.includes(fieldId)), ...elements.filter((elementId): elementId is BusinessCardTemplateTextFieldId => elementId.startsWith("headline-") || elementId.startsWith("body-"))];
}

function applySide(layout: BusinessCardTemplateLayout, sideId: BusinessCardTemplateSideId, elements: BusinessCardUserElementId[]) {
  const side = layout.sides[sideId];
  const fieldIds = selectedTextFields(elements);
  const contactFieldIds = fieldIds.filter((fieldId) => contactFields.includes(fieldId));
  const selectedLogo = elements.some((elementId) => elementId === "logo" || elementId === "brandName" || elementId === "category");

  side.logo = { ...side.logo, visible: selectedLogo, box: containBox(sideId === "front" ? { x: 8, y: 18, width: 28, height: 28 } : { x: 36, y: 18, width: 28, height: 28 }) };
  side.fields = side.fields.map((field) => {
    const visible = fieldIds.includes(field.id);
    const index = fieldIds.indexOf(field.id);

    return visible ? { ...field, visible, box: fieldBox(field.id, index, contactFieldIds.length || fieldIds.length, sideId) } : { ...field, visible: false };
  });
  side.icons = contactFieldIds.flatMap((fieldId, index) => {
    const icon = fieldIconMap[fieldId];

    return icon ? [{ id: `system-${sideId}-${fieldId}-icon`, icon, visible: true, box: containBox({ x: sideId === "front" ? 45 : 9, y: fieldBox(fieldId, index, contactFieldIds.length, sideId).y + 0.4, width: 2.4, height: 2.4 }), color: "#111827" }] : [];
  });
}

export function createBusinessCardLayoutFromSelection(options: Pick<BusinessCardProductionOptions, "frontElements" | "backElements">): BusinessCardTemplateLayout {
  const layout = baseLayout();

  applySide(layout, "front", options.frontElements);
  applySide(layout, "back", options.backElements);

  return layout;
}

export function layoutForBusinessCardOrientation(layout: BusinessCardTemplateLayout, orientation: "horizontal" | "vertical"): BusinessCardTemplateLayout {
  const shortSideMm = Math.min(layout.canvas.trim.widthMm, layout.canvas.trim.heightMm);
  const longSideMm = Math.max(layout.canvas.trim.widthMm, layout.canvas.trim.heightMm);

  return {
    ...layout,
    canvas: {
      ...layout.canvas,
      trim: orientation === "horizontal" ? { widthMm: longSideMm, heightMm: shortSideMm } : { widthMm: shortSideMm, heightMm: longSideMm },
    },
  };
}

export function getBusinessCardLayoutOrientation(layout: BusinessCardTemplateLayout) {
  return layout.canvas.trim.widthMm >= layout.canvas.trim.heightMm ? "horizontal" : "vertical";
}
