/**
 * Converte os formatos numéricos mistos que a planilha exporta:
 * "2374048.74", "10,703,038", "R$ 17.550.525,00", "85,82%", "100%", "-".
 * O separador mais à direita decide qual é o decimal quando há ponto e vírgula.
 */
export function parseNumero(raw: string | null | undefined): number {
  if (!raw) return 0;
  let s = String(raw).trim();
  if (!s || s === '-' || s.startsWith('#')) return 0;

  const negativo = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[R$\s()%-]/g, '');
  if (!s) return 0;

  const temPonto = s.includes('.');
  const temVirgula = s.includes(',');

  if (temPonto && temVirgula) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (temVirgula) {
    const partes = s.split(',');
    // Mais de uma vírgula, ou vírgula seguida de 3 dígitos → separador de milhar.
    if (partes.length > 2 || partes[1]?.length === 3) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  } else if (temPonto) {
    // Vários pontos ("17.550.525") → separador de milhar.
    if (s.split('.').length > 2) s = s.replace(/\./g, '');
  }

  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return negativo ? -n : n;
}

const nfInteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nfDecimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatQuantidade(v: number): string {
  return Number.isInteger(v) ? nfInteiro.format(v) : nfDecimal.format(v);
}

export function formatPercentual(v: number): string {
  return `${nfInteiro.format(Math.round(v))}%`;
}

/**
 * Formato único de dinheiro no painel: R$ 999.999.999,98 — sempre por extenso,
 * com separador de milhar e dois decimais, em qualquer magnitude. Valores
 * financeiros são conferidos contra a planilha oficial, e abreviar ("R$ 17,55
 * mi") impede essa conferência.
 */
export function formatMoeda(v: number): string {
  return nfMoeda.format(v);
}
