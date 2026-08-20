import { Indicador, ParceriaResumo } from '../models/indicadores.model';
import { Recorte } from './agregacao.util';

export interface RetornoDoRecorte {
  aporte: number;
  captado: number;
  liquido: number;
  /** null quando não houve aporte no recorte — sem denominador não há razão. */
  roiPercentual: number | null;
  alavancagem: number | null;
  anosDeAporte: number;
}

/**
 * Retorno financeiro no recorte em vigor.
 *
 * Existe num lugar só porque três telas precisam do mesmo número (o KPI da
 * Home, a página da Linha IV e o relatório) — e porque o ROI acumulado ficava
 * fixo enquanto o resto da tela respondia ao filtro, o que fazia o painel
 * contradizer a si mesmo.
 *
 * Sem recorte, usa os totais que a aba Parceria já consolida. Com anos
 * selecionados, soma aporte e captação daqueles anos.
 */
export function retornoDoRecorte(
  parceria: ParceriaResumo | null,
  captacao: Indicador | undefined,
  recorte: Recorte,
): RetornoDoRecorte | null {
  if (!parceria) return null;

  const aporte =
    recorte === null
      ? parceria.investimentoInicial
      : parceria.aportes
          .filter((a) => recorte.includes(a.ano))
          .reduce((s, a) => s + a.valor, 0);

  const captado =
    recorte === null
      ? parceria.valorCaptado
      : (captacao?.anos ?? [])
          .filter((a) => recorte.includes(a.ano))
          .reduce((s, a) => s + a.realizado, 0);

  return {
    aporte,
    captado,
    liquido: captado - aporte,
    roiPercentual: aporte > 0 ? ((captado - aporte) / aporte) * 100 : null,
    alavancagem: aporte > 0 && captado > 0 ? captado / aporte : null,
    anosDeAporte: parceria.aportes.filter((a) => a.valor > 0).length,
  };
}
