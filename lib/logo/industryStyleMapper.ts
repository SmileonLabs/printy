export type IndustryStyleProfile = {
  category: string;
  visualCues: string[];
  symbols: string[];
  paletteHints: string[];
  toneWords: string[];
};

type IndustryRule = IndustryStyleProfile & {
  matches: string[];
};

const industryRules: IndustryRule[] = [
  {
    matches: ["카페", "베이커리", "음식", "한식", "중식", "일식", "양식", "분식", "치킨", "피자", "술집", "바", "푸드"],
    category: "food and hospitality",
    visualCues: ["warm storefront identity", "appetizing but clean shapes", "welcoming local shop presence"],
    symbols: ["cup silhouette", "grain line", "soft flame", "serving curve"],
    paletteHints: ["cream", "espresso", "warm coral", "soft sage"],
    toneWords: ["welcoming", "fresh", "memorable"],
  },
  {
    matches: ["미용", "네일", "피부", "왁싱", "속눈썹", "메이크업", "헤어", "에스테틱", "마사지", "스파"],
    category: "beauty and wellness",
    visualCues: ["refined salon identity", "delicate curves", "soft premium finish"],
    symbols: ["petal", "glow line", "arched mirror", "spark accent"],
    paletteHints: ["porcelain", "rose beige", "champagne", "soft charcoal"],
    toneWords: ["elegant", "calm", "polished"],
  },
  {
    matches: ["헬스", "필라테스", "요가", "크로스핏", "태권도", "합기도", "복싱", "수영", "골프", "PT"],
    category: "fitness and health",
    visualCues: ["dynamic movement", "stable geometric stance", "energetic rhythm"],
    symbols: ["motion arc", "pulse mark", "shield", "rising line"],
    paletteHints: ["deep navy", "fresh green", "electric blue", "warm white"],
    toneWords: ["active", "confident", "clear"],
  },
  {
    matches: ["학원", "영어", "수학", "코딩", "입시", "음악", "미술", "유치원", "어린이", "과외"],
    category: "education",
    visualCues: ["trustworthy learning brand", "organized friendly structure", "growth metaphor"],
    symbols: ["open book", "star guide", "sprout", "modular blocks"],
    paletteHints: ["clear blue", "sunny yellow", "leaf green", "paper white"],
    toneWords: ["bright", "reliable", "encouraging"],
  },
  {
    matches: ["병원", "의원", "치과", "한의원", "약국", "동물병원", "성형외과", "피부과", "정형외과"],
    category: "medical and clinic",
    visualCues: ["clinical trust", "precise spacing", "calming professional mark"],
    symbols: ["cross", "care leaf", "clean monoline", "protective circle"],
    paletteHints: ["medical blue", "mint", "white", "deep teal"],
    toneWords: ["safe", "precise", "trustworthy"],
  },
  {
    matches: ["쇼핑", "의류", "잡화", "뷰티 쇼핑", "스마트스토어", "쿠팡", "구매대행", "브랜드몰"],
    category: "commerce and retail",
    visualCues: ["retail-ready identity", "recognizable social avatar", "sharp product label feel"],
    symbols: ["tag", "bag handle", "spark", "modular monogram"],
    paletteHints: ["ink black", "vivid accent", "clean white", "soft neutral"],
    toneWords: ["distinct", "marketable", "stylish"],
  },
  {
    matches: ["부동산", "세무", "법무", "변호", "보험", "컨설팅", "광고", "인테리어", "청소", "이사", "렌탈"],
    category: "professional service",
    visualCues: ["credible expert identity", "balanced grid", "quiet authority"],
    symbols: ["pillar", "key line", "structured frame", "abstract check"],
    paletteHints: ["navy", "slate", "silver", "controlled blue"],
    toneWords: ["professional", "stable", "clear"],
  },
  {
    matches: ["프리랜서", "디자이너", "개발자", "마케터", "유튜버", "인플루언서", "사진", "영상", "작가", "강사"],
    category: "creator and personal brand",
    visualCues: ["personal signature", "memorable profile mark", "creative editorial energy"],
    symbols: ["signature stroke", "frame", "spark", "custom monogram"],
    paletteHints: ["black", "off white", "one vivid accent", "warm gray"],
    toneWords: ["expressive", "confident", "original"],
  },
];

const defaultIndustryProfile: IndustryStyleProfile = {
  category: "local business",
  visualCues: ["clear small-business identity", "print-friendly brand mark", "balanced wordmark"],
  symbols: ["simple geometric symbol", "initial mark", "spark accent"],
  paletteHints: ["clean blue", "warm white", "deep ink", "soft neutral"],
  toneWords: ["clear", "useful", "approachable"],
};

const moodProfiles: Record<string, Pick<IndustryStyleProfile, "paletteHints" | "toneWords" | "visualCues">> = {
  premium: {
    paletteHints: ["deep green", "warm beige", "muted gold", "charcoal"],
    toneWords: ["premium", "heritage", "trusted"],
    visualCues: ["luxury spacing", "refined contrast", "quiet confidence"],
  },
  friendly: {
    paletteHints: ["pastel peach", "butter yellow", "soft mint", "warm cream"],
    toneWords: ["friendly", "bright", "approachable"],
    visualCues: ["rounded details", "soft rhythm", "welcoming proportions"],
  },
  creative: {
    paletteHints: ["ink black", "electric accent", "cream", "vivid point color"],
    toneWords: ["unique", "expressive", "artful"],
    visualCues: ["unexpected composition", "custom lettering", "distinct silhouette"],
  },
  natural: {
    paletteHints: ["sage", "clay", "cream", "deep moss"],
    toneWords: ["natural", "warm", "restful"],
    visualCues: ["organic curves", "calm negative space", "soft handmade warmth"],
  },
  strong: {
    paletteHints: ["black", "signal red", "electric blue", "white"],
    toneWords: ["bold", "energetic", "impactful"],
    visualCues: ["high contrast", "strong geometry", "confident scale"],
  },
  simple: {
    paletteHints: ["black", "white", "soft gray", "single accent"],
    toneWords: ["minimal", "modern", "clean"],
    visualCues: ["precise spacing", "simple silhouette", "timeless clarity"],
  },
};

function includesAny(value: string, matches: string[]) {
  return matches.some((match) => value.includes(match));
}

function resolveMoodKey(mood: string) {
  if (includesAny(mood, ["고급", "럭셔리", "엘레강스", "프리미엄", "클래식", "신뢰", "안정", "전문", "기업"])) {
    return "premium";
  }

  if (includesAny(mood, ["귀여", "캐주얼", "밝은", "친근", "아기자기", "소프트", "편안", "힐링"])) {
    return "friendly";
  }

  if (includesAny(mood, ["감성", "트렌디", "힙", "감각", "스타일", "유니크", "창의", "아트", "실험", "개성"])) {
    return "creative";
  }

  if (includesAny(mood, ["자연", "따뜻", "편안", "힐링"])) {
    return "natural";
  }

  if (includesAny(mood, ["강렬", "임팩트", "볼드", "에너지", "다이나믹"])) {
    return "strong";
  }

  return "simple";
}

export function mapIndustryStyle(industry: string, mood: string): IndustryStyleProfile {
  const normalizedIndustry = industry.trim();
  const industryProfile = industryRules.find((rule) => includesAny(normalizedIndustry, rule.matches)) ?? defaultIndustryProfile;
  const moodProfile = moodProfiles[resolveMoodKey(mood)];

  return {
    category: industryProfile.category,
    visualCues: [...moodProfile.visualCues, ...industryProfile.visualCues].slice(0, 5),
    symbols: industryProfile.symbols,
    paletteHints: [...moodProfile.paletteHints, ...industryProfile.paletteHints].slice(0, 6),
    toneWords: [...moodProfile.toneWords, ...industryProfile.toneWords].slice(0, 5),
  };
}
