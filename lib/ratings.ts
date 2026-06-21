export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const RATING_STEP = 0.1;

export function isValidRating(value: number) {
  return Number.isFinite(value)
    && value >= RATING_MIN
    && value <= RATING_MAX
    && Math.abs(value * 10 - Math.round(value * 10)) < Number.EPSILON * 100;
}

