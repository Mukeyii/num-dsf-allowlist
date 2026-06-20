/**
 * escapeHtml.test.ts — pure tests for the HTML escaper used before
 * interpolating untrusted strings into mail bodies. All five dangerous
 * characters (& < > " ') must be escaped, plain text must pass through
 * unchanged, and & must be escaped without double-escaping the entities it
 * produces. No DB.
 */
import { escapeHtml } from '../lib/escapeHtml';

describe('escapeHtml', () => {
  it('escapes the ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double and single quotes', () => {
    expect(escapeHtml(`"quoted" 'single'`)).toBe('&quot;quoted&quot; &#39;single&#39;');
  });

  it('escapes all five characters in one pass', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('returns an empty string for an empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes & before the entity output so there is no double-escape', () => {
    // The literal text "&amp;" must become "&amp;amp;": only the leading &
    // is a special char; the rest is plain text and stays as-is. A buggy
    // escaper that re-scanned its own output would over-escape here.
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('escapes an XSS breakout attempt fully', () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;',
    );
  });
});
