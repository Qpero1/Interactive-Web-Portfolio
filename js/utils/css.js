export function getCSS(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName);
}

export function ms(str) {
  const t = String(str).trim();
  if (!t) return 0;
  return t.endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000;
}
