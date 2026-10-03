/** An address split into the parts the edit form collects. */
export interface AddressParts {
  street: string;
  city: string;
  state: string;
  zip: string;
}

const TAIL = /^(.*?)[,\s]+([A-Za-z]{2})[,\s]+(\d{5}(?:-\d{4})?)$/;

/**
 * Split a stored address string into parts. Handles `street, city, ST 12345`, and legacy values with
 * no spaces (`Meriden,CT,06489`). Anything that doesn't end in `ST ZIP` lands whole in `street` so
 * nothing is lost.
 */
export function parseAddress(raw: string | null | undefined): AddressParts {
  const value = (raw ?? '').trim();
  const m = TAIL.exec(value);
  if (!m) return { street: value, city: '', state: '', zip: '' };
  const head = m[1]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const city = head.pop() ?? '';
  return { street: head.join(', '), city, state: m[2].toUpperCase(), zip: m[3] };
}

/** `street, city, ST 12345` — omits empty parts. */
export function formatAddress(parts: AddressParts): string {
  const stateZip = [parts.state.trim().toUpperCase(), parts.zip.trim()].filter(Boolean).join(' ');
  return [parts.street.trim(), parts.city.trim(), stateZip].filter(Boolean).join(', ');
}

/** Display form of a stored address string (re-spaces legacy values). */
export function displayAddress(raw: string | null | undefined): string {
  const parts = parseAddress(raw);
  return parts.city || parts.state ? formatAddress(parts) : parts.street;
}
