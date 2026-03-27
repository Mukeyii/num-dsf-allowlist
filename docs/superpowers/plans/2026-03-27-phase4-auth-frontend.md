# Phase 4 – Auth Frontend: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete auth UI in React + TypeScript with 4 pages (Login → OTP → TOTP Setup → TOTP), Zustand auth store, Axios API client, and router — all styled with Tailwind CSS in a light indigo design system.

**Architecture:** Single-page app with React Router v6. Auth state (access token) kept in Zustand memory store (never localStorage). Refresh token is an httpOnly cookie managed by the backend. Pages flow: LoginPage → OtpPage → TotpSetupPage (first login) or TotpPage (subsequent) → AppPage.

**Tech Stack:** React 18, TypeScript, Vite, React Router v6, Zustand, Axios, TanStack Query, Tailwind CSS, jwt-decode

---

## File Structure

### New files to create:

| File | Responsibility |
|------|---------------|
| `frontend/tailwind.config.ts` | Tailwind with brand colors/tokens |
| `frontend/src/index.css` | Google Fonts + Tailwind directives |
| `frontend/src/stores/auth.store.ts` | Zustand auth state (token in memory) |
| `frontend/src/api/auth.api.ts` | Axios client for all auth endpoints |
| `frontend/src/router.tsx` | React Router v6 with auth guard |
| `frontend/src/components/AuthLayout.tsx` | Shared auth page layout |
| `frontend/src/pages/LoginPage.tsx` | Email input page |
| `frontend/src/pages/OtpPage.tsx` | 6-digit OTP input with auto-submit |
| `frontend/src/pages/TotpSetupPage.tsx` | QR code + confirm + backup codes |
| `frontend/src/pages/TotpPage.tsx` | TOTP/backup code input for subsequent logins |
| `frontend/src/pages/AppPage.tsx` | Placeholder (Phase 5) |
| `frontend/nginx-frontend.conf` | SPA routing for prod nginx |

### Files to modify:

| File | Change |
|------|--------|
| `frontend/package.json` | Add jwt-decode dependency |
| `frontend/vite.config.ts` | Add path alias + dev proxy |
| `frontend/src/main.tsx` | Replace placeholder with router/query bootstrap |
| `frontend/Dockerfile` | Update CMD for host binding |

---

### Task 1: Frontend Tooling Setup

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tailwind.config.ts` (create/replace)
- Create: `frontend/src/index.css`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/Dockerfile`
- Create: `frontend/nginx-frontend.conf`

- [ ] **Step 1: Add jwt-decode to `frontend/package.json`**

Add `"jwt-decode": "^4.0.0"` to dependencies.

- [ ] **Step 2: Create/replace `frontend/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#ede9ff',
          100: '#d4ccff',
          400: '#8b82ff',
          600: '#6c63ff',
          700: '#5a52d5',
          900: '#2d2880',
        },
        surface: '#f0f2f8',
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
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Create `frontend/src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
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
```

- [ ] **Step 4: Replace `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/auth': 'http://backend:3000',
      '/api':  'http://backend:3000',
    },
  },
});
```

- [ ] **Step 5: Replace `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 6: Create `frontend/nginx-frontend.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|svg|ico|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/tailwind.config.ts frontend/src/index.css frontend/vite.config.ts frontend/Dockerfile frontend/nginx-frontend.conf
git commit -m "feat: setup frontend tooling — Tailwind config, CSS, Vite proxy, Dockerfile, nginx SPA config"
```

---

### Task 2: Auth Store + API Client

**Files:**
- Create: `frontend/src/stores/auth.store.ts`
- Create: `frontend/src/api/auth.api.ts`

- [ ] **Step 1: Create `frontend/src/stores/auth.store.ts`**

```typescript
/**
 * auth.store.ts – Zustand store for auth state
 * accessToken kept in memory (never localStorage/sessionStorage – XSS protection)
 * Refresh token lives as httpOnly cookie – not accessible from JS
 */
import { create } from 'zustand';

interface AuthUser {
  email: string;
  id: string;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  setTokens: (accessToken: string, user: AuthUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setTokens: (accessToken, user) =>
    set({ accessToken, user, isAuthenticated: true }),

  clearAuth: () =>
    set({ accessToken: null, user: null, isAuthenticated: false }),
}));
```

- [ ] **Step 2: Create `frontend/src/api/auth.api.ts`**

```typescript
/**
 * auth.api.ts – Axios client for all auth endpoints
 * Base URL from Vite env variable VITE_API_URL
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export interface OtpRequestResponse {
  data: { message: string };
}

export interface OtpVerifyResponse {
  data: { tempToken: string; requiresTotpSetup: boolean };
}

export interface TotpSetupResponse {
  data: { qrCodeUrl: string };
}

export interface TotpConfirmResponse {
  data: { accessToken: string; backupCodes: string[] };
}

export interface TotpVerifyResponse {
  data: { accessToken: string };
}

export const authApi = {
  requestOtp: (email: string) =>
    api.post<OtpRequestResponse>('/auth/request-otp', { email }),

  verifyOtp: (email: string, code: string) =>
    api.post<OtpVerifyResponse>('/auth/verify-otp', { email, code }),

  setupTotp: (tempToken: string) =>
    api.post<TotpSetupResponse>('/auth/setup-totp', { tempToken }),

  confirmTotp: (tempToken: string, code: string) =>
    api.post<TotpConfirmResponse>('/auth/confirm-totp', { tempToken, code }),

  verifyTotp: (tempToken: string, code: string) =>
    api.post<TotpVerifyResponse>('/auth/verify-totp', { tempToken, code }),

  refresh: () =>
    api.post<{ data: { accessToken: string } }>('/auth/refresh'),

  logout: (email: string) =>
    api.post('/auth/logout', { email }),
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/auth.store.ts frontend/src/api/auth.api.ts
git commit -m "feat: add Zustand auth store and Axios auth API client"
```

---

### Task 3: Router + AuthLayout

**Files:**
- Create: `frontend/src/router.tsx`
- Create: `frontend/src/components/AuthLayout.tsx`

- [ ] **Step 1: Create `frontend/src/components/AuthLayout.tsx`**

```tsx
/**
 * AuthLayout.tsx – Shared layout for all auth pages
 * Centered card on lavender-gray background.
 * Indigo "dsf." logo, environment badge, narrow white card.
 */
import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const ENV       = import.meta.env.VITE_DSF_ENVIRONMENT || 'TEST';
const ENV_COLOR = ENV === 'PRODUCTION' ? '#4a90d9' : '#3ecfb2';

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: '#f0f2f8', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <span
          className="text-3xl font-bold tracking-tight select-none"
          style={{ color: '#6c63ff' }}
        >
          dsf.
        </span>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="text-sm text-gray-500">Allow List Management</span>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{ color: ENV_COLOR, borderColor: ENV_COLOR + '44', background: ENV_COLOR + '11' }}
          >
            {ENV}
          </span>
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-md bg-white p-8"
        style={{
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(108,99,255,0.07)',
          border: '1px solid #e8eaf0',
        }}
      >
        <h1
          className="text-xl font-semibold mb-1"
          style={{ color: '#1a1a2e' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mb-6" style={{ color: '#9b9fad' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs" style={{ color: '#9b9fad' }}>
        GECKO Institute · Hochschule Heilbronn
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/router.tsx`**

```typescript
/**
 * router.tsx – React Router v6 configuration
 * Public routes: /login, /otp, /totp-setup, /totp
 * Protected routes: /app/* (Phase 5)
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage }     from './pages/LoginPage';
import { OtpPage }       from './pages/OtpPage';
import { TotpSetupPage } from './pages/TotpSetupPage';
import { TotpPage }      from './pages/TotpPage';
import { AppPage }       from './pages/AppPage';
import { useAuthStore }  from './stores/auth.store';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/',          element: <Navigate to="/login" replace /> },
  { path: '/login',     element: <LoginPage /> },
  { path: '/otp',       element: <OtpPage /> },
  { path: '/totp-setup',element: <TotpSetupPage /> },
  { path: '/totp',      element: <TotpPage /> },
  {
    path: '/app/*',
    element: <RequireAuth><AppPage /></RequireAuth>,
  },
]);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AuthLayout.tsx frontend/src/router.tsx
git commit -m "feat: add AuthLayout component and React Router with auth guard"
```

---

### Task 4: LoginPage + OtpPage

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/OtpPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/LoginPage.tsx`**

Full content from spec (Schritt 7) — email input, submit sends OTP request, always navigates to /otp regardless of backend response, indigo button, border focus states.

- [ ] **Step 2: Create `frontend/src/pages/OtpPage.tsx`**

Full content from spec (Schritt 8) — 6 individual digit inputs with auto-focus, paste support, auto-submit on 6 digits, resend button, back to login link.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/OtpPage.tsx
git commit -m "feat: add LoginPage and OtpPage with 6-digit auto-submit input"
```

---

### Task 5: TotpSetupPage + TotpPage

**Files:**
- Create: `frontend/src/pages/TotpSetupPage.tsx`
- Create: `frontend/src/pages/TotpPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/TotpSetupPage.tsx`**

Full content from spec (Schritt 9) — 3-step flow (QR → confirm → backup codes), jwt-decode for token parsing, saves to Zustand store.

- [ ] **Step 2: Create `frontend/src/pages/TotpPage.tsx`**

Full content from spec (Schritt 10) — accepts 6-digit TOTP or 8-char backup code, toggle between modes, jwt-decode + Zustand store.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/TotpSetupPage.tsx frontend/src/pages/TotpPage.tsx
git commit -m "feat: add TotpSetupPage with QR/backup codes and TotpPage for subsequent logins"
```

---

### Task 6: AppPage + main.tsx Update

**Files:**
- Create: `frontend/src/pages/AppPage.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create `frontend/src/pages/AppPage.tsx`**

Full content from spec (Schritt 11) — placeholder showing user email, avatar initial, sign out button.

- [ ] **Step 2: Replace `frontend/src/main.tsx`**

```tsx
/**
 * main.tsx – App bootstrap
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AppPage.tsx frontend/src/main.tsx
git commit -m "feat: add AppPage placeholder and update main.tsx with router/query bootstrap"
```

---

## Acceptance Criteria (from spec)

- [ ] `docker-compose up frontend` starts, http://localhost:5173 reachable
- [ ] `/login` — email input, button disabled when empty
- [ ] `/otp` — 6 individual inputs, auto-focus, paste support, auto-submit at 6 digits
- [ ] `/otp` — "Resend code" works, new email in Mailhog
- [ ] `/totp-setup` — QR code visible, scannable with Google Authenticator
- [ ] `/totp-setup` — After code entry: 10 backup codes displayed
- [ ] `/app` — placeholder shows logged-in email
- [ ] Second login: `/totp` instead of `/totp-setup` (no setup again)
- [ ] Sign-out clears token from store, redirects to `/login`
- [ ] Direct navigation to `/app` without login → redirect to `/login`
- [ ] Design: indigo accent `#6c63ff`, white card on `#f0f2f8` background
- [ ] No access token in localStorage or sessionStorage
