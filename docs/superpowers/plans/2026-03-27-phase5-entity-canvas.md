# Phase 5 – Entity Graph Canvas: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the main app page — all 6 entities (Organization, Contacts, Endpoints, Certificates, Memberships, Approval) displayed simultaneously on a canvas with SVG relation lines, a 220px sidebar, a 280px right panel, and a top bar. Design from docs/stitch/code.html.

**Architecture:** AppPage uses a 3-column layout (Sidebar | Canvas | RightPanel). EntityCanvas renders a 2×3 CSS grid of entity cards with an SVG overlay for Bezier relation lines. Each card fetches its data via TanStack Query hooks backed by an Axios API client. FK links between cards trigger highlight animations. Canvas store (Zustand) manages active instance and highlight state.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, TanStack Query, Zustand, Axios, SVG (relation lines), Material Symbols Outlined, Inter + JetBrains Mono fonts

---

## File Structure

### New files (27):

| File | Responsibility |
|------|---------------|
| `SPEC.md` | UI/UX design reference |
| `frontend/src/stores/canvas.store.ts` | Canvas UI state (active instance, highlights) |
| `frontend/src/api/entities.api.ts` | Axios client for all entity endpoints |
| `frontend/src/hooks/useInstance.ts` | Instance list + auto-select first |
| `frontend/src/hooks/useOrganization.ts` | Organization query + mutation |
| `frontend/src/hooks/useContacts.ts` | Contacts query + mutations |
| `frontend/src/hooks/useEndpoints.ts` | Endpoints query + mutations |
| `frontend/src/hooks/useCertificates.ts` | Certificates query + mutations |
| `frontend/src/hooks/useMemberships.ts` | Memberships query + mutations |
| `frontend/src/hooks/useApproval.ts` | Approval status/history + submit |
| `frontend/src/components/cards/EntityCard.tsx` | Shared card wrapper |
| `frontend/src/components/cards/FkLink.tsx` | FK link with highlight |
| `frontend/src/components/cards/OrganizationCard.tsx` | Org card |
| `frontend/src/components/cards/ContactsCard.tsx` | Contacts card |
| `frontend/src/components/cards/EndpointsCard.tsx` | Endpoints card |
| `frontend/src/components/cards/CertificatesCard.tsx` | Certificates card |
| `frontend/src/components/cards/MembershipsCard.tsx` | Memberships card |
| `frontend/src/components/cards/ApprovalCard.tsx` | Approval card |
| `frontend/src/components/canvas/RelationLines.tsx` | SVG Bezier overlay |
| `frontend/src/components/canvas/EntityCanvas.tsx` | 2×3 grid + SVG |
| `frontend/src/components/layout/Sidebar.tsx` | Left nav 220px |
| `frontend/src/components/layout/RightPanel.tsx` | Right panel 280px |
| `frontend/src/components/layout/TopBar.tsx` | Canvas top bar |

### Files to modify (3):

| File | Change |
|------|--------|
| `frontend/tailwind.config.ts` | Add Stitch color tokens |
| `frontend/src/index.css` | Add fonts + utility classes |
| `frontend/src/pages/AppPage.tsx` | Replace placeholder with full canvas |

---

### Task 1: Design Tokens — SPEC.md + Tailwind + CSS Updates

**Files:**
- Create: `SPEC.md`
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Create `SPEC.md` in project root**

```markdown
# SPEC.md – UI/UX Design-Referenz

> Light Mode. Indigo-Akzent. Weiße Karten auf lavendelgrauem Hintergrund.
> Referenz-Stil: modernes SaaS-Dashboard (drive.-Ästhetik).

## Farben
- Page background:  #f0f2f8
- Card background:  #ffffff
- Primary accent:   #6c63ff  (Indigo)
- Text primary:     #1a1a2e
- Text muted:       #9b9fad
- Border:           #e8eaf0

## Entity-Akzentfarben (Left-Border + Icon)
- Organization:  #6c63ff
- Contacts:      #9b59b6
- Endpoints:     #3ecfb2
- Certificates:  #f5a623
- Memberships:   #4a90d9
- Approval:      #e05c5c

## Shapes
- Card radius:    16px
- Button radius:  10px
- Input radius:   10px
- Card shadow:    0 2px 8px rgba(108,99,255,0.07)

## Layout
- Sidebar:      220px, white, border-right #e8eaf0
- Right Panel:  280px, #f0f2f8, border-left #e8eaf0
- Canvas gap:   20px
- Card padding: 18px 20px
```

- [ ] **Step 2: Replace `frontend/tailwind.config.ts` with Stitch tokens**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f7f9ff',
        surface: '#f7f9ff',
        'surface-container-low': '#f1f3f9',
        'surface-container-lowest': '#ffffff',
        'on-surface': '#181c20',
        'on-surface-variant': '#464555',
        'outline-variant': '#c7c4d8',
        primary: '#4d41df',
        'primary-container': '#675df9',
        secondary: '#006b5a',
        tertiary: '#805200',
        error: '#ba1a1a',
        brand: {
          50:  '#ede9ff',
          100: '#d4ccff',
          400: '#8b82ff',
          600: '#6c63ff',
          700: '#5a52d5',
          900: '#2d2880',
        },
        canvas: '#f0f2f8',
        card:    '#ffffff',
        border:  '#e8eaf0',
        muted:   '#9b9fad',
        ink:     '#1a1a2e',
      },
      borderRadius: {
        card:   '16px',
        button: '10px',
        input:  '10px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(108,99,255,0.07)',
        'card-hover': '0 4px 16px rgba(108,99,255,0.13)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Replace `frontend/src/index.css` with full fonts + utilities**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1');
@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.entity-card-shadow {
  box-shadow: 0 4px 20px -2px rgba(77, 65, 223, 0.04),
              0 2px 8px -1px rgba(77, 65, 223, 0.02);
}

.glass-panel {
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.8);
}

.mono-id {
  font-family: 'JetBrains Mono', monospace;
}

.canvas-bg {
  background-color: #f0f2f8;
}

@keyframes pulse-teal {
  0%   { box-shadow: 0 0 0 0   rgba(0, 107, 90, 0.2); }
  70%  { box-shadow: 0 0 0 6px rgba(0, 107, 90, 0);   }
  100% { box-shadow: 0 0 0 0   rgba(0, 107, 90, 0);   }
}

.status-pulse {
  animation: pulse-teal 2s infinite;
}
```

- [ ] **Step 4: Commit**

```bash
git add SPEC.md frontend/tailwind.config.ts frontend/src/index.css
git commit -m "feat: add SPEC.md and update Tailwind/CSS with Stitch design tokens"
```

---

### Task 2: Canvas Store + Entities API Client

**Files:**
- Create: `frontend/src/stores/canvas.store.ts`
- Create: `frontend/src/api/entities.api.ts`

(Full code provided in spec Steps 2–3. Create with EXACT content from spec.)

- [ ] **Step 1: Create canvas.store.ts**
- [ ] **Step 2: Create entities.api.ts**
- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/canvas.store.ts frontend/src/api/entities.api.ts
git commit -m "feat: add canvas store and entities API client"
```

---

### Task 3: All TanStack Query Hooks (7 files)

**Files:**
- Create: `frontend/src/hooks/useInstance.ts`
- Create: `frontend/src/hooks/useOrganization.ts`
- Create: `frontend/src/hooks/useContacts.ts`
- Create: `frontend/src/hooks/useEndpoints.ts`
- Create: `frontend/src/hooks/useCertificates.ts`
- Create: `frontend/src/hooks/useMemberships.ts`
- Create: `frontend/src/hooks/useApproval.ts`

(useInstance and useOrganization code given in spec. Others follow same pattern.)

- [ ] **Step 1: Create all 7 hook files**
- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add TanStack Query hooks for all entities"
```

---

### Task 4: EntityCard Wrapper + FkLink

**Files:**
- Create: `frontend/src/components/cards/EntityCard.tsx`
- Create: `frontend/src/components/cards/FkLink.tsx`

(Full code in spec Steps 7–8.)

- [ ] **Step 1: Create EntityCard.tsx**
- [ ] **Step 2: Create FkLink.tsx**
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cards/EntityCard.tsx frontend/src/components/cards/FkLink.tsx
git commit -m "feat: add EntityCard wrapper and FkLink highlight component"
```

---

### Task 5: SVG RelationLines + EntityCanvas

**Files:**
- Create: `frontend/src/components/canvas/RelationLines.tsx`
- Create: `frontend/src/components/canvas/EntityCanvas.tsx`

(Full code in spec Steps 5–6.)

- [ ] **Step 1: Create RelationLines.tsx**
- [ ] **Step 2: Create EntityCanvas.tsx**
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/canvas/
git commit -m "feat: add SVG relation lines and 2x3 entity canvas grid"
```

---

### Task 6: OrganizationCard + ContactsCard

**Files:**
- Create: `frontend/src/components/cards/OrganizationCard.tsx`
- Create: `frontend/src/components/cards/ContactsCard.tsx`

(Full code in spec Steps 9–10.)

- [ ] **Step 1: Create OrganizationCard.tsx**
- [ ] **Step 2: Create ContactsCard.tsx**
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cards/OrganizationCard.tsx frontend/src/components/cards/ContactsCard.tsx
git commit -m "feat: add OrganizationCard and ContactsCard"
```

---

### Task 7: EndpointsCard + CertificatesCard

**Files:**
- Create: `frontend/src/components/cards/EndpointsCard.tsx`
- Create: `frontend/src/components/cards/CertificatesCard.tsx`

(Full code in spec Steps 11–12.)

- [ ] **Step 1: Create EndpointsCard.tsx**
- [ ] **Step 2: Create CertificatesCard.tsx**
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cards/EndpointsCard.tsx frontend/src/components/cards/CertificatesCard.tsx
git commit -m "feat: add EndpointsCard and CertificatesCard"
```

---

### Task 8: MembershipsCard + ApprovalCard

**Files:**
- Create: `frontend/src/components/cards/MembershipsCard.tsx`
- Create: `frontend/src/components/cards/ApprovalCard.tsx`

(Full code in spec Step 12.)

- [ ] **Step 1: Create MembershipsCard.tsx**
- [ ] **Step 2: Create ApprovalCard.tsx**
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/cards/MembershipsCard.tsx frontend/src/components/cards/ApprovalCard.tsx
git commit -m "feat: add MembershipsCard and ApprovalCard"
```

---

### Task 9: Layout — Sidebar + TopBar

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/TopBar.tsx`

(Full code in spec Steps 13 + 15. Note: Sidebar needs `import { useState } from 'react';` added.)

- [ ] **Step 1: Create Sidebar.tsx (with useState import fix)**
- [ ] **Step 2: Create TopBar.tsx**
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/components/layout/TopBar.tsx
git commit -m "feat: add Sidebar with navigation and TopBar with gradient CTA"
```

---

### Task 10: RightPanel + AppPage + Token Refresh

**Files:**
- Create: `frontend/src/components/layout/RightPanel.tsx`
- Modify: `frontend/src/pages/AppPage.tsx` (full replacement)

(Full code in spec Steps 14, 16, 17.)

- [ ] **Step 1: Create RightPanel.tsx**
- [ ] **Step 2: Replace AppPage.tsx with full canvas layout**
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/RightPanel.tsx frontend/src/pages/AppPage.tsx
git commit -m "feat: add RightPanel, replace AppPage with full entity canvas layout"
```

---

## Acceptance Criteria

- [ ] Tailwind config has all Stitch color tokens
- [ ] Inter + JetBrains Mono + Material Symbols loaded
- [ ] Sidebar: 220px, dsf. logo, nav items with Material icons, active state
- [ ] Cards: rounded-[16px], entity-card-shadow, border-l-4, hover:-translate-y-1
- [ ] TopBar: pill with env badge, gradient button
- [ ] Right Panel: 280px fixed, approval status, gradient CTA
- [ ] SVG lines: 6 dashed Bezier curves, correct colors, redraw on resize
- [ ] FK link click → target card highlights 1.8s, scrolls into view
- [ ] Certificates: progress bar (green/amber/red by expiry)
- [ ] Memberships: check_circle/schedule icons
- [ ] No token in localStorage
