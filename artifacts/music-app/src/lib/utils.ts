import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Render provider-supplied titles as text instead of showing HTML entities. */
export function decodeHtmlEntities(value: string | null | undefined): string {
  if (!value) return "";
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDisplayDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function isSongExpired(song: { expiresAt?: string | null }): boolean {
  return Boolean(song.expiresAt && new Date(song.expiresAt).getTime() <= Date.now());
}
