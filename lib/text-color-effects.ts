import type { CSSProperties } from "react";

export const textGradientOptions = [
  { value: "gradient:gold", title: "금색 그라데이션", background: "linear-gradient(135deg, #8a5a00 0%, #f7d774 32%, #fff3b0 50%, #c89116 72%, #6f4700 100%)" },
  { value: "gradient:silver", title: "은색 그라데이션", background: "linear-gradient(135deg, #5f6670 0%, #d9dde3 32%, #ffffff 50%, #9ca3af 72%, #4b5563 100%)" },
] as const;

export const textSolidColorOptions = ["#111827", "#ffffff"] as const;

export function textGradientBackground(value: string) {
  return textGradientOptions.find((option) => option.value === value)?.background;
}

export function textColorInputValue(value: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (value === "gradient:gold") return "#d4af37";
  if (value === "gradient:silver") return "#c0c0c0";
  return "#111827";
}

export function textColorStyle(value: string): CSSProperties {
  const backgroundImage = textGradientBackground(value);

  if (!backgroundImage) {
    return { color: value };
  }

  return { color: "transparent", backgroundImage, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" };
}

export function textColorCss(value: string) {
  const backgroundImage = textGradientBackground(value);

  return backgroundImage ? `color:transparent;background-image:${backgroundImage};background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;` : `color:${value};`;
}
