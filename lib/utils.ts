export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function yearOf(date?: string | null) {
  return date ? date.slice(0, 4) : "TBA";
}

export function minutesToLabel(minutes?: number | null) {
  if (!minutes) return "Runtime TBA";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
