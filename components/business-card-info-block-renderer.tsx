import type { CSSProperties } from "react";
import { businessCardTemplateIconArtwork } from "@/lib/business-card-templates";
import { adminCanvasReferenceWidthPx, businessCardContactItemGapPx, businessCardIconChromeStyle, businessCardInfoBlockIconSvgPreserveAspectRatio, businessCardInfoBlockIconTextGapStylePx, estimatedBusinessCardTextWidthEm, fittedBusinessCardFontSizePx, fontFamilies, formatPercent, getBusinessCardInfoBlockRenderMetrics, getBusinessCardInfoBlockRowRenderMetrics, readSafeColor, type BusinessCardContactRow, type BusinessCardInfoBlock } from "@/lib/business-card-rendering";
import type { BusinessCardTemplateTextAlign, BusinessCardTemplateTextElement } from "@/lib/types";

function justifyContentForTextAlign(align: BusinessCardTemplateTextAlign): CSSProperties["justifyContent"] {
  if (align === "center") {
    return "center";
  }

  if (align === "right") {
    return "flex-end";
  }

  return "flex-start";
}

function textStyle(field: BusinessCardTemplateTextElement, cssPixelScale: number, value?: string, availableWidthPercent = field.box.width, trimWidthScale = 1, paddingPx = 0): CSSProperties {
  return {
    color: readSafeColor(field.color, "#111827"),
    fontFamily: fontFamilies[field.fontFamily],
    fontSize: `${value === undefined ? formatPercent(field.fontSize * cssPixelScale, 8) : fittedBusinessCardFontSizePx(field, value, cssPixelScale, availableWidthPercent, paddingPx, trimWidthScale)}px`,
    fontStyle: field.italic || field.fontFamily === "handwriting" ? "italic" : "normal",
    fontWeight: field.fontWeight === "bold" ? 900 : 400,
    lineHeight: 1.3,
    textAlign: field.align,
  };
}

function contactRowFontScale(row: BusinessCardContactRow, cssPixelScale: number, availableWidthPercent: number, gapPx: number, trimWidthScale: number, paddingPx: number) {
  if (row.id !== "contact" || row.items.length <= 1) {
    return 1;
  }

  const availableWidthPx = Math.max(1, (adminCanvasReferenceWidthPx * cssPixelScale * trimWidthScale * (availableWidthPercent / 100) - paddingPx) * 0.99);
  const totalGapPx = gapPx * (row.items.length - 1);
  const totalTextWidthPx = row.items.reduce((total, item) => total + estimatedBusinessCardTextWidthEm(item.value) * item.field.fontSize * cssPixelScale, 0);

  return totalTextWidthPx + totalGapPx > availableWidthPx ? Math.max(0.1, (availableWidthPx - totalGapPx) / totalTextWidthPx) : 1;
}

function boxStyle(box: BusinessCardInfoBlock["box"]): CSSProperties {
  return {
    left: `${formatPercent(box.x, 0)}%`,
    top: `${formatPercent(box.y, 0)}%`,
    width: `${formatPercent(box.width, 1)}%`,
    height: `${formatPercent(box.height, 1)}%`,
  };
}

export function BusinessCardInfoBlockRenderer({ block, cssPixelScale, gapScale = 1, trimWidthScale = 1, className = "absolute z-[2] overflow-visible" }: { block: BusinessCardInfoBlock; cssPixelScale: number; gapScale?: number; trimWidthScale?: number; className?: string }) {
  const firstField = block.rows[0]?.items[0]?.field;
  const metrics = getBusinessCardInfoBlockRenderMetrics(block);
  const firstRowMetrics = block.rows[0] ? getBusinessCardInfoBlockRowRenderMetrics(block, block.rows[0]) : undefined;
  const iconTopPercent = firstRowMetrics ? firstRowMetrics.topPercent + firstRowMetrics.heightPercent / 2 : 50;
  const iconChrome = businessCardIconChromeStyle(cssPixelScale);

  if (!firstField) {
    return null;
  }

  return (
    <div className={className} style={{ ...boxStyle(block.box), ...textStyle(firstField, cssPixelScale) }}>
      {block.icon ? (
        <span className="absolute flex -translate-y-1/2 items-center justify-end overflow-visible" style={{ left: `${formatPercent(metrics.iconLeftPercent, 0)}%`, top: `${formatPercent(iconTopPercent, 50)}%`, width: `${formatPercent(metrics.iconWidthPercent, 0)}%`, height: `${formatPercent(metrics.iconHeightPercent, 0)}%`, border: `${iconChrome.borderWidthPx}px solid transparent`, color: readSafeColor(block.icon.color, "#075dcb"), padding: `${iconChrome.paddingPx}px` }} aria-hidden="true">
          <svg className="block h-full w-full" viewBox={businessCardTemplateIconArtwork[block.icon.icon].viewBox} preserveAspectRatio={businessCardInfoBlockIconSvgPreserveAspectRatio}>
            <path d={businessCardTemplateIconArtwork[block.icon.icon].path} fill="currentColor" />
          </svg>
        </span>
      ) : null}
      {block.rows.map((row) => {
        const rowMetrics = getBusinessCardInfoBlockRowRenderMetrics(block, row);
        const iconTextGapPx = block.icon ? businessCardInfoBlockIconTextGapStylePx(block, gapScale) : 0;
        const rowLeft = block.icon ? `calc(${formatPercent(metrics.iconTextPaddingPercent, 0)}% + ${iconTextGapPx}px)` : `${formatPercent(metrics.paddingLeftPercent, 0)}%`;
        const itemGapPx = row.id === "contact" ? businessCardContactItemGapPx * gapScale : 0.35;
        const rowAvailableWidthPercent = Math.max(1, 100 - (block.icon ? metrics.iconTextPaddingPercent : metrics.paddingLeftPercent));
        const rowAvailableCanvasWidthPercent = block.box.width * (rowAvailableWidthPercent / 100);
        const contactFontScale = contactRowFontScale(row, cssPixelScale, rowAvailableCanvasWidthPercent, row.id === "contact" ? itemGapPx : 0, trimWidthScale, iconTextGapPx);
        const contactGapReservePercent = row.id === "contact" ? Math.min(rowAvailableWidthPercent - 1, row.items.length * 3) : 0;
        const itemAvailableWidthPercent = Math.max(1, block.box.width * ((rowAvailableWidthPercent - contactGapReservePercent) / 100) / row.items.length);

        return (
          <span key={row.id} className="absolute flex min-w-0 items-center overflow-hidden whitespace-nowrap" style={{ left: rowLeft, right: 0, top: `${formatPercent(rowMetrics.topPercent, 0)}%`, height: `${formatPercent(rowMetrics.heightPercent, 100)}%`, gap: row.id === "contact" ? `${formatPercent(itemGapPx, businessCardContactItemGapPx)}px` : `${itemGapPx}em`, justifyContent: justifyContentForTextAlign(firstField.align) }}>
            {row.items.map((item) => (
              <span key={item.field.id} className="flex-none overflow-visible" style={{ ...textStyle(item.field, cssPixelScale, item.value, itemAvailableWidthPercent, trimWidthScale, row.id === "contact" ? 0 : iconTextGapPx), ...(row.id === "contact" ? { fontSize: `${formatPercent(item.field.fontSize * cssPixelScale * contactFontScale, item.field.fontSize * cssPixelScale)}px` } : undefined) }}>{item.value}</span>
            ))}
          </span>
        );
      })}
    </div>
  );
}
