import type {
  Brand,
  BrandAsset,
  BrandDetailSectionId,
  BrandView,
  BusinessCardDraft,
  GeneratedLogoOption,
  LocalAuthInput,
  LocalAuthSession,
  LocalUser,
  LoginRedirectTarget,
  LogoGenerationIntent,
  LogoGenerationMode,
  LogoGenerationStatus,
  MainTab,
  Member,
  OnboardingStep,
  OrderOptions,
  OrderRecord,
  PaymentMethod,
  PrintProduct,
  PrintTemplate,
} from "@/lib/types";
import type { BrandWorkspace } from "@/lib/brand-workspace";

export type PrintyState = {
  currentStep: OnboardingStep;
  onboardingComplete: boolean;
  activeTab: MainTab;
  brandView: BrandView;
  activeBrandSection: BrandDetailSectionId;
  brandDraft: {
    name: string;
    category: string;
    designRequest: string;
  };
  memberDraft: Member;
  selectedLogoId: string;
  generatedLogoOptions: GeneratedLogoOption[];
  savedGeneratedLogoOptions: GeneratedLogoOption[];
  logoGenerationStatus: LogoGenerationStatus;
  logoGenerationMessage?: string;
  logoGenerationMode: LogoGenerationMode;
  selectedLogoReferenceImageId?: string;
  logoGenerationTargetBrandId?: string;
  logoGenerationIntent: LogoGenerationIntent;
  logoRevisionRequest: string;
  logoRevisionSourceLogoId?: string;
  orderOptions: OrderOptions;
  selectedPaymentMethod: PaymentMethod;
  isAuthenticated: boolean;
  users: LocalUser[];
  authSession?: LocalAuthSession;
  selectedBrandId?: string;
  activeBusinessCardDraftId?: string;
  lastOrderId?: string;
  brands: Brand[];
  businessCardDrafts: BusinessCardDraft[];
  orders: OrderRecord[];
  printProducts: PrintProduct[];
  templates: PrintTemplate[];
  brandAssets: BrandAsset[];
  selectedProductId?: string;
  selectedTemplateId?: string;
  selectedBusinessCardMemberIds: string[];
  loginRedirectTarget?: LoginRedirectTarget;
  loginBackStep?: OnboardingStep;
  brandWorkspaceHasPendingLocalChanges: boolean;
  brandWorkspaceOwnerUserId?: string;
  setStep: (step: OnboardingStep, loginRedirectTarget?: LoginRedirectTarget) => void;
  updateBrandDraft: <K extends keyof PrintyState["brandDraft"]>(field: K, value: PrintyState["brandDraft"][K]) => void;
  selectLogo: (logoId: string) => void;
  selectBrandLogo: (brandId: string, logoId: string) => void;
  deleteBrandLogo: (brandId: string, logoId: string) => void;
  startLogoGeneration: () => void;
  finishLogoGeneration: (status: Extract<LogoGenerationStatus, "success">, logos: GeneratedLogoOption[], message?: string) => void;
  failLogoGeneration: (message: string) => void;
  setLogoGenerationMode: (mode: LogoGenerationMode) => void;
  selectLogoReferenceImage: (referenceImageId?: string) => void;
  startLogoRevision: (sourceLogoId: string) => void;
  updateLogoRevisionRequest: (value: string) => void;
  cancelLogoRevision: () => void;
  submitLogoRevision: () => void;
  startAdditionalLogoForBrand: (brandId: string) => void;
  updateMemberDraft: (field: keyof Member, value: string) => void;
  updateOrderOption: <K extends keyof OrderOptions>(field: K, value: OrderOptions[K]) => void;
  selectPaymentMethod: (method: PaymentMethod) => void;
  addBrandMember: (brandId: string, member: Member) => void;
  login: (input: LocalAuthInput, redirectTarget?: LoginRedirectTarget) => void;
  logout: () => void;
  saveBrandShell: () => void;
  ensureBusinessCardDraft: () => BusinessCardDraft;
  completeCheckout: () => void;
  enterDashboard: () => void;
  startNewBrand: () => void;
  setActiveTab: (tab: MainTab) => void;
  openNotifications: () => void;
  openBrandDetail: (brandId: string) => void;
  closeBrandDetail: () => void;
  goBack: () => void;
  setBrandSection: (sectionId: BrandDetailSectionId) => void;
  startProduct: (productId: string) => void;
  selectTemplate: (templateId: string) => void;
  syncTemplates: (templates: PrintTemplate[]) => void;
  resetTemplatesToSeeds: () => void;
  syncBrandWorkspace: (workspace: BrandWorkspace, ownerUserId?: string) => void;
  acknowledgeBrandWorkspaceSave: (savedSignature: string, ownerUserId: string) => void;
  startCardEdit: () => void;
  startBrandSectionProduction: (brandId: string, sectionId: BrandDetailSectionId, memberIds?: string[]) => void;
};
