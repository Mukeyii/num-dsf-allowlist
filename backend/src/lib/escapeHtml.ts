/**
 * escapeHtml.ts – HTML-escape untrusted strings before interpolation into mail
 * bodies. Covers the five characters that can break out of element content or a
 * double-quoted attribute value (& < > " ').
 */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  );
}
