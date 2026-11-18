// Small helpers that turn backend numbers into the labels the design shows.

export const feedbackLabel = (id: number | string) => `FB-${String(id).padStart(6, '0')}`;
export const caseLabel = (id: number | string) => `CASE-${1000 + Number(id)}`;

/** "FB-000012" -> 12 and "12" -> 12. */
export const numericId = (label: string | number): number => Number(String(label).replace(/\D/g, ''));
/** "CASE-1012" -> 12. */
export const caseNumericId = (label: string | number): number => Number(String(label).replace(/\D/g, '')) - 1000;

const AVATAR_COLORS = ['#4338F5', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#14B8A6'];

/** A tiny initials avatar, so people without a photo still get a face in the lists. */
export function avatarFor(name: string): string {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="${color}"/><text x="48" y="60" font-family="Arial,sans-serif" font-size="38" font-weight="700" fill="#fff" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

export const whole = (value: unknown): number => Math.round(Number(value) || 0);
