import { ANOS_PARCERIA, Indicador } from '../models/indicadores.model';

/**
 * Os indicadores misturam unidades (quantidade, %, NPS, R$), então nenhuma
 * soma direta entre eles é válida. Toda agregação normaliza cada indicador
 * pelo próprio alvo (realizado ÷ meta, capado em 100%) e tira a média — o
 * "cumprimento médio" que o painel exibe.
 */
export interface Cumprimento {
  pct: number;
  total: number;
  atingidos: number;
}

/** Meta/realizado do recorte: um ano específico ou o acumulado (Meta Total × YTD). */
export function valoresDoRecorte(
  ind: Indicador,
  ano: number | null,
): { meta: number; realizado: number } {
  if (ano === null) return { meta: ind.metaTotal, realizado: ind.realizadoTotal };
  const doAno = ind.anos.find((a) => a.ano === ano);
  return { meta: doAno?.meta ?? 0, realizado: doAno?.realizado ?? 0 };
}

export function cumprimento(indicadores: Indicador[], ano: number | null): Cumprimento {
  let soma = 0;
  let total = 0;
  let atingidos = 0;
  for (const ind of indicadores) {
    const { meta, realizado } = valoresDoRecorte(ind, ano);
    if (meta <= 0) continue;
    const razao = realizado / meta;
    soma += Math.min(razao, 1);
    total++;
    if (razao >= 1) atingidos++;
  }
  return { pct: total ? (soma / total) * 100 : 0, total, atingidos };
}

/**
 * Indicadores cujo realizado é estoque, não estado: contagens e R$ se somam ano
 * a ano rumo a um alvo de 2028. NPS e "percentual de execução do plano" são
 * medidas do período — somá-los ao longo dos anos (NPS 85 + 79 + 90 = 254?) não
 * significa nada, então ficam fora de qualquer leitura acumulada.
 */
export function ehCumulativo(ind: Indicador): boolean {
  return ind.unidade === 'quantidade' || ind.unidade === 'moeda';
}

export interface PontoAvanco {
  ano: number;
  /** % da meta 2028 já entregue. null nos anos que ainda não começaram. */
  realizado: number | null;
  /** % da meta 2028 que o cronograma previa ter entregue até o fim do ano. */
  plano: number;
  /** Ano em curso: o plano já conta o ano inteiro, o realizado vai só até hoje. */
  parcial: boolean;
}

/**
 * Avanço rumo à meta final da parceria (burn-up): para cada ano, quanto do alvo
 * de 2028 já foi entregue e quanto o cronograma previa. Cresce por construção —
 * o realizado é acumulado e o denominador é fixo (a meta total), diferente de
 * uma taxa de cumprimento ano a ano, que sobe e desce.
 *
 * Cada indicador é normalizado pela própria meta total e capado em 100% antes da
 * média, porque as unidades não são somáveis entre si.
 */
export function avancoRumoAMetaFinal(indicadores: Indicador[]): PontoAvanco[] {
  const cumulativos = indicadores
    .filter(ehCumulativo)
    .map((ind) => ({
      // A planilha traz "Meta Total"; quando vem vazia, o alvo é a soma do cronograma.
      alvo: ind.metaTotal > 0 ? ind.metaTotal : ind.anos.reduce((s, a) => s + a.meta, 0),
      anos: ind.anos,
    }))
    .filter((ind) => ind.alvo > 0);

  if (!cumulativos.length) return [];

  const ultimo = ultimoAnoComDados(indicadores.filter(ehCumulativo));
  const anoCorrente = new Date().getFullYear();

  return ANOS_PARCERIA.map((ano) => {
    let somaRealizado = 0;
    let somaPlano = 0;
    for (const ind of cumulativos) {
      let realizado = 0;
      let plano = 0;
      for (const a of ind.anos) {
        if (a.ano <= ano) {
          realizado += a.realizado;
          plano += a.meta;
        }
      }
      somaRealizado += Math.min(realizado / ind.alvo, 1);
      somaPlano += Math.min(plano / ind.alvo, 1);
    }
    const n = cumulativos.length;
    return {
      ano,
      realizado: ultimo !== null && ano <= ultimo ? (somaRealizado / n) * 100 : null,
      plano: (somaPlano / n) * 100,
      parcial: ano === ultimo && ano >= anoCorrente,
    };
  });
}

/** Último ano com algum realizado — evita plotar futuro como se fosse queda. */
export function ultimoAnoComDados(indicadores: Indicador[]): number | null {
  let ultimo: number | null = null;
  for (const ind of indicadores) {
    for (const a of ind.anos) {
      if (a.realizado > 0 && (ultimo === null || a.ano > ultimo)) ultimo = a.ano;
    }
  }
  return ultimo;
}
