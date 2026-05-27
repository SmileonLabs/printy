# Design Project Refactor Plan

This plan defines the next development priority for Printy before adding more promotional products. The current product surfaces work, but business cards and print products evolved separately. Continuing with the current structure will multiply editor code, storage paths, AI mockup paths, and dashboard flows for every new product.

## Decision

Pause new product UI work until the design project foundation is in place.

The target architecture is:

1. A shared `DesignProject` storage model for every editable design.
2. A shared editor core for canvas operations.
3. Product adapters for business cards, banners, signage, and future promotional products.
4. A shared mockup, preview, completion, and PDF lifecycle.

## Current Problems

### Split Storage Models

Business cards use:

- `BusinessCardDraft` in `lib/types.ts`
- `businessCardDrafts` in Zustand
- `AiBusinessCardMockup` in local state and `ai_business_card_mockups`
- `completedMockupSignature` to connect a draft to finished mockups

Print products use:

- `PrintProductDraft` in `lib/types.ts`
- `printProductDrafts` in Zustand and workspace sync
- inline `mockups`, `selectedMockupId`, `pdfUrl`, and `pdfFileName`

This creates different answers for the same questions:

- What is a draft?
- What is a completed design?
- Where is the selected mockup stored?
- Which layout is source of truth?
- How do we edit a completed design?
- How do we support multiple designs per product?

### Split Editor Implementations

Business card editing lives mainly in:

- `components/admin/business-card-layout-builder.tsx`
- `components/printy/onboarding/business-card-preview-screen.tsx`
- `components/printy/templates/business-card-print-preview-overlay.tsx`
- `components/printy/templates/business-card-template-renderer.tsx`

Print product editing lives mainly in:

- `components/printy/print-products/print-product-editor.tsx`
- `components/printy/print-products/print-product-preview-overlay.tsx`
- `components/printy/print-products/product-production-section.tsx`
- `lib/print-products/pdf-html.ts`

The duplicated behavior includes:

- canvas sizing
- selection
- drag
- resize
- grid and snap
- undo
- delete
- text rendering
- font fitting
- gradient text
- QR rendering
- logo rendering
- preview overlay
- PDF HTML output

### Split Lifecycles

Business card flow currently has special handling for:

- layout draft
- AI mockup generation
- completed mockup storage
- clean background editing
- PDF generation
- edit completed mockup

Print product flow has separate handling for:

- draft creation
- layout update
- AI background prompt
- mockup generation
- mockup deletion
- selected mockup
- PDF generation

The product flows should be variations of one lifecycle, not separate implementations.

## Target Concepts

### DesignProject

All editable production work should be represented as a project.

```ts
type DesignProject = {
  id: string;
  brandId: string;
  productType: DesignProductType;
  title: string;
  status: "draft" | "completed";
  layout: DesignLayout;
  mockups: DesignMockup[];
  selectedMockupId?: string;
  pdf?: DesignPdfRecord;
  source?: "business-card-draft" | "print-product-draft" | "design-project";
  createdAt: string;
  updatedAt: string;
};
```

### DesignProductType

```ts
type DesignProductType =
  | "business-card"
  | "banner"
  | "signage"
  | "flyer"
  | "poster"
  | "brochure";
```

### DesignLayout

Business cards become a two-page project. Banners, signage, and most promotional products become single-page projects.

```ts
type DesignLayout = {
  canvas: {
    widthMm: number;
    heightMm: number;
    bleedMm?: number;
    safeMarginMm?: number;
  };
  pages: DesignPage[];
};
```

```ts
type DesignPage = {
  id: string;
  label: string;
  background?: DesignBackground;
  elements: DesignElement[];
};
```

### DesignElement

```ts
type DesignElement =
  | DesignTextElement
  | DesignLogoElement
  | DesignImageElement
  | DesignQrElement
  | DesignLineElement
  | DesignShapeElement;
```

Element fields should use normalized units:

- position and size as percentages of page canvas
- typography in millimeters or normalized print units
- color tokens supporting hex and text effects such as `gradient:gold`
- stable IDs for selection and updates

### DesignMockup

```ts
type DesignMockup = {
  id: string;
  imageUrl: string;
  cleanImageUrl?: string;
  title: string;
  layoutSnapshot: DesignLayout;
  createdAt: string;
};
```

Rules:

- `layout` is always the editable source of truth.
- `mockup.imageUrl` is a visual reference.
- `mockup.cleanImageUrl` is a generated background image.
- Text, QR, logo, and precise elements are always rendered from `layout` or `layoutSnapshot`.
- A completed mockup must always have `layoutSnapshot`.
- Editing a completed mockup loads `layoutSnapshot` into the editor.

## Product Adapters

Each product should provide an adapter instead of a copied editor.

```ts
type DesignProductAdapter = {
  productType: DesignProductType;
  label: string;
  defaultTitle: string;
  createDefaultLayout(input: DesignAdapterInput): DesignLayout;
  normalizeLayout(value: unknown): DesignLayout | undefined;
  buildMockupPrompt(input: DesignMockupPromptInput): string;
  buildPdfInput(project: DesignProject): DesignPdfInput;
  getOrderOptions?(project: DesignProject): DesignOrderOption[];
};
```

Initial adapters:

- `businessCardAdapter`
- `bannerAdapter`
- `signageAdapter`

Future adapters:

- `flyerAdapter`
- `posterAdapter`
- `brochureAdapter`
- `stickerAdapter`

## Shared Editor Core

Create these modules before replacing screens:

- `lib/design-editor/types.ts`
- `lib/design-editor/geometry.ts`
- `lib/design-editor/selection.ts`
- `lib/design-editor/history.ts`
- `lib/design-editor/normalizer.ts`
- `lib/design-editor/text-effects.ts`
- `lib/design-editor/rendering.ts`
- `components/design-editor/design-editor.tsx`
- `components/design-editor/editor-canvas.tsx`
- `components/design-editor/editor-toolbar.tsx`
- `components/design-editor/element-controls.tsx`
- `components/design-editor/design-preview-overlay.tsx`

Shared behavior:

- page selection
- element selection
- multi-select
- drag
- resize
- keyboard delete
- undo
- grid visibility
- snap behavior
- text style controls
- gradient text controls
- logo placement
- QR placement
- background preview
- clean mockup overlay

Product-specific behavior must be adapter-owned, not editor-owned.

## Shared Lifecycle

All product flows should use the same lifecycle:

1. Create project.
2. Edit layout.
3. Save draft.
4. Generate mockups.
5. Select mockup.
6. Continue editing over selected clean mockup.
7. Save completed design.
8. Generate PDF.

Button meanings:

- `임시 저장`: save current `DesignProject.layout`.
- `목업 생성`: generate new `DesignMockup[]` for current project.
- `미리보기 재적용`: rerender current layout over selected clean mockup.
- `디자인 저장`: save selected mockup with current layout snapshot.
- `PDF 만들기`: generate print PDF from project layout and selected mockup background.

## Server/API Target

Add new routes while preserving old ones during migration.

- `GET /api/design-projects?brandId=...`
- `POST /api/design-projects`
- `GET /api/design-projects/[projectId]`
- `PUT /api/design-projects/[projectId]`
- `DELETE /api/design-projects/[projectId]`
- `POST /api/design-projects/[projectId]/mockups`
- `DELETE /api/design-projects/[projectId]/mockups/[mockupId]`
- `POST /api/design-projects/[projectId]/pdf`

Server module:

- `lib/server/design-projects.ts`

Storage rule:

- DB/server APIs are the source of truth for persisted projects.
- Zustand only owns UI session state, active project, editor selections, and unsaved draft state.

## Migration Strategy

Do not break existing production data.

Phase 1 should be read-compatible:

- Convert `BusinessCardDraft` to `DesignProject` in read adapters.
- Convert saved `AiBusinessCardMockup` rows to `DesignMockup` in read adapters.
- Convert `PrintProductDraft` to `DesignProject` in read adapters.
- Keep old persisted keys and existing API routes alive.

Phase 2 should write new projects:

- New saves write to `DesignProject` storage.
- Existing old data can still be read.
- Old flows can be bridged through adapters during transition.

Phase 3 should backfill:

- Add an authenticated server-side migration/backfill route or script if needed.
- Move old business card drafts and print product drafts into design projects.
- Keep id mapping where orders still reference old draft IDs.

Phase 4 should delete old write paths:

- Stop writing `businessCardDrafts` and `printProductDrafts` for new work.
- Keep read fallback for shipped data until no longer needed.

## Development Priority

### P0: Stop Expanding Product-Specific Code

Do not add a new promotional product by copying `print-product-editor.tsx` or `business-card-layout-builder.tsx`.

Do not add another product-specific mockup store.

### P1: DesignProject Foundation

Deliverables:

- `lib/design-projects/types.ts`
- `lib/design-projects/normalizers.ts`
- `lib/design-projects/adapters/business-card.ts`
- `lib/design-projects/adapters/print-product.ts`
- adapter tests or focused normalizer smoke checks

Acceptance criteria:

- Existing business card drafts can be represented as `DesignProject`.
- Existing AI business card mockups can be represented as `DesignMockup`.
- Existing print product drafts can be represented as `DesignProject`.
- No existing persisted shape is removed.

### P2: Project List in Dashboard

Deliverables:

- shared project list model in brand detail
- support multiple projects per product type
- actions for create/edit/delete/select project

Acceptance criteria:

- A brand can show multiple banner/signage designs.
- Business card completed mockups and drafts appear through one project list concept.
- Legacy data remains visible.

### P3: Unified Project Save API

Deliverables:

- `lib/server/design-projects.ts`
- `/api/design-projects` routes
- workspace sync updated to include projects or bridge projects from legacy data

Acceptance criteria:

- Authenticated project create/update/load works through server APIs.
- Local Zustand no longer acts as final source of truth for persisted project data.
- Empty server payload cannot wipe local visible project data.

### P4: Shared Preview Renderer

Deliverables:

- shared preview overlay for `DesignLayout`
- shared text effect rendering
- shared QR/logo/image rendering
- shared PDF HTML render input

Acceptance criteria:

- Browser preview and PDF use the same layout representation.
- Gradient text renders the same in editor, overlay, and PDF.
- QR renders the same in editor, overlay, and PDF.

### P5: Shared Editor Core

Deliverables:

- shared canvas component
- shared element controls
- shared drag/resize/selection/history hooks
- product adapter integration

Acceptance criteria:

- Business card and banner use the same editor core.
- Product differences are handled by adapters.
- Adding a new product does not require a new editor implementation.

### P6: Move Business Cards to DesignProject

Deliverables:

- business card create/edit/save uses `DesignProject`
- AI mockup generation attaches to project
- completed mockup editing loads `layoutSnapshot`
- PDF generation reads project layout

Acceptance criteria:

- No signature-only dependency for editing completed designs.
- `디자인 수정하기` always opens the project with selected mockup visible.
- `임시 저장` and `디자인 저장` have different, stable meanings.

### P7: Move Print Products to DesignProject

Deliverables:

- banner/signage create/edit/save uses `DesignProject`
- multiple projects per product type
- mockup deletion and selected mockup stored on project
- PDF generation reads project layout

Acceptance criteria:

- A brand can create multiple banners.
- A brand can create multiple signage designs.
- Project list reloads consistently after login/reload.

### P8: Remove Legacy Duplication

Remove or shrink:

- business card-only mockup coordination in onboarding screen
- print product-only draft management where replaced
- duplicate preview overlays
- duplicate PDF HTML renderers
- duplicate QR/gradient rendering
- signature fallback code that is no longer needed for new projects

Keep only documented legacy read fallbacks until old production data is migrated.

### P9: Add Promotional Products

Only after P1 through P7 are stable.

Adding a promotional product should mean:

- add adapter
- add sizes/order options
- add prompt rules
- add product listing copy

It should not mean:

- new editor copy
- new draft store
- new mockup store
- new PDF renderer copy

## Suggested Work Chunks

Chunk 1:

- Add `DesignProject` types and normalizers.
- Add legacy adapters only.
- No UI behavior changes.

Chunk 2:

- Add project read model to dashboard.
- Show legacy business card and print product work as projects.
- No write-path migration yet.

Chunk 3:

- Add server API for projects.
- Save new projects through API.
- Keep legacy read fallback.

Chunk 4:

- Extract shared renderer from current business card and print product overlays.
- Keep current editors.

Chunk 5:

- Extract shared editor core from current editors.
- Replace business card editor first.

Chunk 6:

- Replace banner/signage editor with shared editor.
- Enable multiple projects.

Chunk 7:

- Clean old code and document remaining legacy fallback.

## Files to Inspect During Implementation

Core types and persistence:

- `lib/types.ts`
- `lib/brand-workspace.ts`
- `lib/server/brand-workspace.ts`
- `store/printy-store-types.ts`
- `store/printy-store-catalog-actions.ts`
- `store/printy-store-onboarding-actions.ts`
- `store/printy-store-workspace-actions.ts`
- `store/printy-store-persistence.ts`

Business card flow:

- `components/printy/onboarding/business-card-preview-screen.tsx`
- `components/admin/business-card-layout-builder.tsx`
- `components/printy/dashboard/brand-detail.tsx`
- `components/printy/templates/business-card-print-preview-overlay.tsx`
- `components/printy/templates/business-card-template-renderer.tsx`
- `lib/ai-business-card/client.ts`
- `lib/server/ai-business-card-mockups.ts`

Print product flow:

- `components/printy/print-products/product-production-section.tsx`
- `components/printy/print-products/print-product-editor.tsx`
- `components/printy/print-products/print-product-preview-overlay.tsx`
- `lib/print-products/adapters.ts`
- `lib/print-products/server.ts`
- `lib/print-products/pdf-html.ts`

## Risks

- Existing production data may use legacy shapes. Keep read adapters until migration is verified.
- Orders may reference old `BusinessCardDraft` IDs. Preserve order references or provide an explicit mapping.
- PDF output must not regress while preview/editor code is shared.
- AI prompt behavior may change if product adapters are not carefully scoped.
- Zustand persisted state must remain readable during migration.

## Verification Requirements

For each phase:

- focused ESLint on changed files
- `npx.cmd tsc --noEmit`
- `npm.cmd run build` when shared UI/store/server code changes
- production smoke after deploy

Manual smoke checks when UI changes:

- login and workspace reload
- create business card design
- save draft
- generate mockup
- edit completed mockup
- generate PDF
- create multiple banner/signage projects
- delete and select mockups
- reload and verify project list remains intact

## Immediate Next Step

Implement P1 only:

- Add `lib/design-projects/types.ts`.
- Add `lib/design-projects/normalizers.ts`.
- Add legacy conversion helpers for `BusinessCardDraft`, `AiBusinessCardMockup`, and `PrintProductDraft`.
- Add focused checks.

Do not change UI behavior in P1. The goal is to create a stable model before moving screens.
