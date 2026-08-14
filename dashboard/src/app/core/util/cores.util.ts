/**
 * Resolve um token de cor do Material (--mat-sys-*) para uma cor concreta.
 * Necessário para o canvas do Chart.js: com theme-type color-scheme os tokens
 * valem `light-dark(...)`, que só resolve quando aplicado a uma propriedade
 * real — por isso o elemento-sonda em vez de getPropertyValue direto.
 */
export function corDoToken(token: string): string {
  const sonda = document.createElement('span');
  sonda.style.color = `var(${token})`;
  sonda.style.display = 'none';
  document.body.appendChild(sonda);
  const cor = getComputedStyle(sonda).color;
  sonda.remove();
  return cor;
}

/** Aplica alpha a uma cor `rgb(r, g, b)` resolvida pelo navegador. */
export function comAlpha(cor: string, alpha: number): string {
  const m = cor.match(/^rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return cor;
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
}
