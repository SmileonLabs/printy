"use client";

import Image from "next/image";
import { logoOptions } from "@/lib/mock-data";
import type { GeneratedLogoOption, ResolvedLogoOption } from "@/lib/types";

type PrintyBrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
};

export function PrintyBrandLogo({ size = "md", showWordmark = true }: PrintyBrandLogoProps) {
  const sizes = {
    sm: { width: 112, height: 41 },
    md: { width: 148, height: 54 },
    lg: { width: 200, height: 73 },
  }[size];

  return <Image src="/printy_logo.png" alt="Printy" width={sizes.width} height={sizes.height} className="h-auto w-auto shrink-0 object-contain" data-wordmark-visible={showWordmark} priority />;
}

export function LogoMark({ logo, size = "md" }: { logo: ResolvedLogoOption; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm: "h-12 w-12 text-base",
    md: "h-16 w-16 text-xl",
    lg: "h-24 w-24 text-3xl",
    xl: "h-32 w-32 text-4xl",
  };
  const imageSizes = {
    sm: 48,
    md: 64,
    lg: 96,
    xl: 128,
  };

  if ("imageUrl" in logo) {
    return (
      <div className={`${sizes[size]} overflow-hidden rounded-lg border border-line bg-surface shadow-soft`}>
        <Image src={logo.imageUrl} alt={logo.name} width={imageSizes[size]} height={imageSizes[size]} className="h-full w-full object-contain" unoptimized />
      </div>
    );
  }

  const shapeClass = {
    circle: "rounded-full",
    square: "rounded-lg",
    pill: "rounded-full",
    diamond: "rotate-45 rounded-md",
    arch: "rounded-t-full rounded-b-lg",
    spark: "rounded-lg",
  }[logo.shape];
  const textClass = logo.shape === "diamond" ? "-rotate-45" : "";

  return (
    <div className={`${sizes[size]} ${shapeClass} relative grid place-items-center border border-line font-display font-black shadow-soft`} style={{ background: logo.background, color: logo.accent }}>
      <span className={textClass}>{logo.initial}</span>
      {logo.shape === "spark" ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" /> : null}
    </div>
  );
}

export function getLogo(logoId: string, generatedLogos: GeneratedLogoOption[] = []): ResolvedLogoOption {
  return generatedLogos.find((logo) => logo.id === logoId) ?? logoOptions.find((logo) => logo.id === logoId) ?? logoOptions[0];
}
