/**
 * approvalState.ts – Pure helpers for the 4-eyes approval state machine.
 *
 * Status derivation rules:
 *   - Any REJECT sig                            → REJECTED
 *   - 2+ APPROVE sigs from different sites      → APPROVED
 *   - 1 APPROVE sig older than silentConsentDays
 *     and no REJECT sig                          → APPROVED (silent consent)
 *   - Otherwise                                  → PENDING
 *
 * Site identity = lowercased email domain.
 */

export interface ApprovalSig {
  admin_email: string;
  admin_site: string;
  decision: 'APPROVE' | 'REJECT';
  signed_at: Date | string;
}

export type DerivedStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export function siteOfEmail(email: string): string {
  if (email.startsWith('SYSTEM:')) return '';
  const at = email.indexOf('@');
  if (at < 0 || at === email.length - 1) return '';
  return email.slice(at + 1).toLowerCase();
}

export function deriveStatus(
  sigs: ApprovalSig[],
  now: Date,
  silentConsentDays: number,
): DerivedStatus {
  if (sigs.some((s) => s.decision === 'REJECT')) return 'REJECTED';
  const approves = sigs.filter((s) => s.decision === 'APPROVE');
  const sites = new Set(approves.map((s) => s.admin_site));
  if (sites.size >= 2) return 'APPROVED';
  if (approves.length >= 1) {
    const first = approves.map((s) => new Date(s.signed_at).getTime()).sort((a, b) => a - b)[0];
    const ageMs = now.getTime() - first;
    if (ageMs >= silentConsentDays * 86400_000) return 'APPROVED';
  }
  return 'PENDING';
}

export function validateApproval(
  existingSigs: ApprovalSig[],
  newAdminEmail: string,
  newAdminSite: string,
):
  | null
  | 'ALREADY_DECIDED'
  | 'ALREADY_APPROVED_SAME_SITE'
  | 'REQUEST_REJECTED'
  | 'REQUEST_APPROVED' {
  if (
    existingSigs.some(
      (s) => s.admin_email.toLowerCase().trim() === newAdminEmail.toLowerCase().trim(),
    )
  )
    return 'ALREADY_DECIDED';
  if (existingSigs.some((s) => s.decision === 'REJECT')) return 'REQUEST_REJECTED';
  const approveSites = existingSigs
    .filter((s) => s.decision === 'APPROVE')
    .map((s) => s.admin_site);
  if (approveSites.length >= 2 && new Set(approveSites).size >= 2) return 'REQUEST_APPROVED';
  if (approveSites.includes(newAdminSite)) return 'ALREADY_APPROVED_SAME_SITE';
  return null;
}
