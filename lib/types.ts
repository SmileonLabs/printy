export type OnboardingStep =
  | "home"
  | "brandCreation"
  | "logoDirection"
  | "generating"
  | "logoSelection"
  | "logoSave"
  | "logoRevision"
  | "memberInput"
  | "businessCardPreview"
  | "businessCardBatchPreview"
  | "orderOptions"
  | "templateSelection"
  | "login"
  | "checkout"
  | "success";

export type MainTab = "home" | "brands" | "templates" | "orders" | "my" | "notifications";

export type LoginRedirectTarget = "checkout" | "dashboard";

export type BrandView = "list" | "detail";

export type BrandDetailSectionId =
  | "style"
  | "team"
  | "cards"
  | "promotions"
  | "banners"
  | "signage"
  | "files";

export type LogoShape = "circle" | "square" | "pill" | "diamond" | "arch" | "spark";

export type LogoGenerationInput = {
  brandName: string;
  industry: string;
  designRequest: string;
  referenceImageId?: string;
};

export type LogoGenerationMode = "manual" | "reference" | "auto";

export type LogoReferenceImage = {
  id: string;
  name: string;
  imageUrl: string;
  contentType: "image/png" | "image/jpeg";
  size: number;
  createdAt: string;
  analysis?: LogoReferenceImageAnalysis;
};

export type LogoReferenceImageAnalysis = {
  status: "ready" | "skipped" | "failed";
  source: "admin" | "user";
  summary: string;
  styleTags: string[];
  colorNotes: string;
  compositionNotes: string;
  cautionNotes: string;
  forcedInstructions?: string;
  analyzedAt: string;
  model?: string;
};

export type LogoGenerationIntent = "initial" | "revision";

export type LogoRevisionSourceLogo = {
  id: string;
  imageUrl: string;
  label?: string;
  description?: string;
  promptSummary?: string;
  lens?: string;
  designRequest?: string;
  requestSummary?: string;
};

export type LogoRevisionGenerationInput = {
  brandName: string;
  industry: string;
  revisionRequest: string;
  sourceLogo: LogoRevisionSourceLogo;
};

export type LogoPlanSource = "user" | "recommended";

export type LogoVariationDraft = {
  id: string;
  label: string;
  source?: LogoPlanSource;
  lens?: string;
  designRequest?: string;
  requestSummary?: string;
  promptSummary?: string;
  revisionOfLogoId?: string;
  revisionRequest?: string;
  layout: string;
  typography: string;
  colorPalette: string;
  concept: string;
  complexity: string;
};

export type LogoVariation = LogoVariationDraft & {
  prompt: string;
};

export type LogoGenerationPlan = Required<Pick<LogoVariationDraft, "source" | "lens" | "designRequest" | "requestSummary" | "promptSummary">> & LogoVariation;

export type LogoOption = {
  id: string;
  name: string;
  label: string;
  initial: string;
  shape: LogoShape;
  accent: string;
  background: string;
  description: string;
};

export type GeneratedLogoSource = "openai";

export type GeneratedLogoOption = {
  id: string;
  name: string;
  label: string;
  description: string;
  imageUrl: string;
  source: GeneratedLogoSource;
  prompt?: string;
  promptSummary?: string;
  planSource?: LogoPlanSource;
  lens?: string;
  designRequest?: string;
  requestSummary?: string;
  variationLabel?: string;
  keywords?: string[];
  revisionOfLogoId?: string;
  revisionRequest?: string;
};

export type LogoGenerationStatus = "idle" | "generating" | "success" | "error";

export type LogoGenerationResponse = {
  status: "success";
  reason?: string;
  logos: GeneratedLogoOption[];
};

export type ResolvedLogoOption = LogoOption | GeneratedLogoOption;

export type Member = {
  id: string;
  name: string;
  role: string;
  phone: string;
  mainPhone: string;
  fax: string;
  email: string;
  website?: string;
  address: string;
};

export type Brand = {
  id: string;
  name: string;
  category: string;
  designRequest: string;
  selectedLogoId: string;
  logoIds: string[];
  members: Member[];
  createdAt: string;
  assets: number;
};

export type BusinessCardDraft = {
  id: string;
  brandId?: string;
  brandName: string;
  category: string;
  designRequest: string;
  selectedLogoId: string;
  templateId?: string;
  member: Member;
  createdAt: string;
};

export type OrderOptions = {
  quantity: string;
  paper: string;
  finish: string;
  delivery: string;
};

export type PaymentMethod = "간편결제" | "카드" | "계좌이체";

export type OrderRecord = {
  id: string;
  orderNumber: string;
  title: string;
  status: "paid" | "preparing";
  statusLabel: string;
  price: string;
  quantity: string;
  paper: string;
  paymentMethod: PaymentMethod;
  createdAt: string;
  brandId: string;
  cardDraftId: string;
  templateId?: string;
};

export type LocalUser = {
  id: string;
  name: string;
  contact: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalAuthSession = {
  userId: string;
  name: string;
  contact: string;
  authenticatedAt: string;
};

export type LocalAuthInput = {
  id?: string;
  name: string;
  contact: string;
  authenticatedAt?: string;
};

export type QuickProductionItem = {
  id: string;
  title: string;
  helper: string;
};

export type PrintProduct = QuickProductionItem & {
  productType: "business-card" | "flyer" | "banner" | "poster" | "sticker";
};

export type BusinessCardTemplateSideId = "front" | "back";

export type BusinessCardTemplateTextFieldId = "role" | "name" | "phone" | "email" | "website" | "address" | "mainPhone" | "fax";

export type BusinessCardTemplateFontFamily = "sans" | "serif" | "rounded" | "mono" | "display" | "handwriting";

export type BusinessCardTemplateTextWeight = "regular" | "bold";

export type BusinessCardTemplateTextAlign = "left" | "center" | "right";

export type BusinessCardTemplateIconId = "phone" | "email" | "location" | "fax" | "building" | "web";

export type BusinessCardTemplateBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BusinessCardTemplateCanvas = {
  trim: {
    widthMm: number;
    heightMm: number;
  };
  edit: BusinessCardTemplateBox;
  safe: BusinessCardTemplateBox;
};

export type BusinessCardTemplateLogoElement = {
  visible: boolean;
  box: BusinessCardTemplateBox;
};

export type BusinessCardTemplateTextElement = {
  id: BusinessCardTemplateTextFieldId;
  visible: boolean;
  box: BusinessCardTemplateBox;
  fontFamily: BusinessCardTemplateFontFamily;
  fontSize: number;
  color: string;
  fontWeight: BusinessCardTemplateTextWeight;
  italic: boolean;
  align: BusinessCardTemplateTextAlign;
  customValue?: string;
};

export type BusinessCardTemplateIconElement = {
  id: string;
  icon: BusinessCardTemplateIconId;
  visible: boolean;
  box: BusinessCardTemplateBox;
  color: string;
  textGapPx?: number;
};

export type BusinessCardTemplateLineElement = {
  id: string;
  orientation: "horizontal" | "vertical";
  visible: boolean;
  box: BusinessCardTemplateBox;
  color: string;
};

export type BusinessCardTemplateBackground =
  | {
      enabled: false;
    }
  | {
      enabled: true;
      type: "color";
      color: string;
    }
  | {
      enabled: true;
      type: "image";
      imageUrl: string;
      color?: string;
    };

export type BusinessCardTemplateSideLayout = {
  logo: BusinessCardTemplateLogoElement;
  fields: BusinessCardTemplateTextElement[];
  icons: BusinessCardTemplateIconElement[];
  lines: BusinessCardTemplateLineElement[];
  background: BusinessCardTemplateBackground;
};

export type BusinessCardTemplateLayout = {
  canvas: BusinessCardTemplateCanvas;
  sides: Record<BusinessCardTemplateSideId, BusinessCardTemplateSideLayout>;
};

export type PrintTemplate = {
  id: string;
  productId: string;
  title: string;
  summary: string;
  tags: string[];
  orientation?: "horizontal" | "vertical";
  previewVariant?: string;
  status?: "draft" | "published";
  source?: "seed" | "admin";
  layout?: BusinessCardTemplateLayout;
  updatedAt?: string;
  brandId?: string;
  createdAt: string;
};

export type BrandAsset = {
  id: string;
  brandId: string;
  sectionId: BrandDetailSectionId;
  productId: string;
  title: string;
  description: string;
  createdAt: string;
};

export type RecentOrder = {
  id: string;
  title: string;
  status: "printing" | "delivered";
  statusLabel: string;
  price: string;
  orderedAt: string;
};
