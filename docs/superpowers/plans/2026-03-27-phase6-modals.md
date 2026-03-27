# Phase 6 – Formulare + Modals: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all Add/Edit/Delete buttons to real modals with React Hook Form + Zod validation, toast notifications, and glassmorphism backdrop. 7 modals + confirm dialog + toast provider.

**Architecture:** Central modal state via Zustand (useModals store). Each modal uses React Hook Form with zodResolver for client-side validation. Sonner for toast notifications. Portal-based Modal wrapper with glassmorphism backdrop. Entity cards call openModal() from the store.

**Tech Stack:** React Hook Form, Zod, @hookform/resolvers, sonner (toasts), React portals

---

## Tasks:
1. Zod schemas (5 files) + package.json update
2. Modal wrapper + FormField + ConfirmModal + ToastProvider
3. OrganizationModal + ContactModal
4. EndpointModal + CertificateModal
5. MembershipModal + ApprovalModal + DownloadModal
6. useModals hook + wire into AppPage + update entity cards + main.tsx
