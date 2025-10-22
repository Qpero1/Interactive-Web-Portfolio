export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function approach(value, target, delta) {
  if (value < target) return Math.min(value + delta, target);
  if (value > target) return Math.max(value - delta, target);
  return value;
}
