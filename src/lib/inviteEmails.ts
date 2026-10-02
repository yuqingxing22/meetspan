const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

/** Split pasted text on commas, semicolons, spaces and new lines; drop repeats. */
export function parseEmails(text: string): { good: string[]; bad: string[] } {
  const seen = new Set<string>();
  const good: string[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const e = raw.trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    (EMAIL_RE.test(e) ? good : bad).push(e);
  }
  return { good, bad };
}
