import type { BrandDetailSectionId, LogoOption, MainTab, PrintProduct } from "@/lib/types";

export const logoOptions: LogoOption[] = [
  {
    id: "lumen",
    name: "루멘 블루",
    label: "프리미엄",
    initial: "P",
    shape: "circle",
    accent: "var(--color-primary)",
    background: "var(--color-surface-blue)",
    description: "밝고 신뢰감 있는 첫인상",
  },
  {
    id: "clear",
    name: "클리어 라인",
    label: "미니멀",
    initial: "Pt",
    shape: "square",
    accent: "var(--color-primary-strong)",
    background: "var(--color-canvas)",
    description: "깔끔한 전문가 이미지",
  },
  {
    id: "orbit",
    name: "오빗 마크",
    label: "성장형",
    initial: "P",
    shape: "pill",
    accent: "var(--color-primary)",
    background: "var(--color-primary-soft)",
    description: "확장성과 속도감 강조",
  },
  {
    id: "mono",
    name: "모노 스탬프",
    label: "정갈함",
    initial: "프",
    shape: "diamond",
    accent: "var(--color-primary-strong)",
    background: "var(--color-surface)",
    description: "인쇄물에 선명한 상징성",
  },
  {
    id: "arc",
    name: "아크 심볼",
    label: "친근함",
    initial: "P",
    shape: "arch",
    accent: "var(--color-primary)",
    background: "var(--color-canvas)",
    description: "부드럽고 열린 브랜드 톤",
  },
  {
    id: "signal",
    name: "시그널 포인트",
    label: "선명함",
    initial: "P",
    shape: "spark",
    accent: "var(--color-primary)",
    background: "var(--color-surface-blue)",
    description: "작은 크기에서도 또렷함",
  },
];

export const quantities = ["100", "200", "500"];

export const papers = ["일반", "고급"];

export const seedPrintProducts: PrintProduct[] = [
  { id: "business-card", productType: "business-card", title: "명함", helper: "첫 인상 제작" },
  { id: "flyer", productType: "flyer", title: "전단지", helper: "행사 홍보" },
  { id: "banner", productType: "banner", title: "배너 / 현수막", helper: "매장 앞 주목" },
  { id: "poster", productType: "poster", title: "포스터", helper: "공간 장식" },
  { id: "sticker", productType: "sticker", title: "스티커", helper: "패키지 포인트" },
];

export const bottomTabs: Array<{ id: MainTab; label: string }> = [
  { id: "home", label: "홈" },
  { id: "brands", label: "내 브랜드" },
  { id: "orders", label: "주문내역" },
  { id: "my", label: "마이페이지" },
];

export const brandDetailSections: Array<{ id: BrandDetailSectionId; label: string; summary: string }> = [
  { id: "style", label: "로고 & 스타일", summary: "대표 로고, 컬러, 인쇄 톤 관리" },
  { id: "team", label: "팀 / 구성원", summary: "명함에 들어갈 구성원 정보" },
  { id: "cards", label: "명함", summary: "주문 가능한 명함 시안" },
  { id: "promotions", label: "홍보물", summary: "전단지와 쿠폰 추천 템플릿" },
  { id: "banners", label: "배너 / 현수막", summary: "매장 앞 배너 빠른 제작" },
  { id: "signage", label: "간판", summary: "외부 사인 적용 미리보기" },
  { id: "files", label: "파일 보관함", summary: "주문 파일과 원본 보관" },
];

export const orderHighlights = ["로고 자동 적용", "명함 시안 저장", "주문 기록 보관"];
