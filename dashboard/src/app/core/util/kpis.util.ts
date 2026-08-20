import {
  ANOS_PARCERIA,
  ContagemPorAno,
  EntregasOperacionais,
  Indicador,
  ParceriaResumo,
} from '../models/indicadores.model';
import { Recorte, contagemDoRecorte, valoresDoRecorte } from './agregacao.util';
import { retornoDoRecorte } from './retorno.util';
import { formatMoeda, formatPercentual, formatQuantidade } from './numero.util';

export interface Kpi {
  rotulo: string;
  valor: string;
  nota: string;
  /** Progresso contra a meta do recorte, quando o indicador tem meta. */
  meta?: { pct: number; rotulo: string; atingido: boolean };
  /** Série anual do realizado — vira o gráfico miúdo no card. */
  serie?: { ano: number; valor: number }[];
  /** Card em destaque na grade (o que a leitura procura primeiro). */
  destaque?: boolean;
}

/**
 * Os dez indicadores-chave da parceria, na ordem definida com o cliente.
 *
 * Vive aqui, e não na Home, porque o Relatório Executivo precisa exatamente da
 * mesma lista: se cada tela montasse a sua, um dia o PDF diria um número e a
 * página diria outro. Cada KPI declara a origem na nota — vários não estão na
 * aba Metas e vêm das abas operacionais.
 *
 * Além do número, cada KPI carrega o que o card sabe desenhar: o progresso
 * contra a meta (anel) ou a série ano a ano (gráfico miúdo). São dados reais,
 * não enfeite — é o que dá relevo ao card sem inventar cor nova.
 */
export function kpisDaParceria(
  indicadores: Indicador[],
  entregas: EntregasOperacionais | null,
  parceria: ParceriaResumo | null,
  ano: Recorte,
  rotuloRecorte: string,
): Kpi[] {
  const lista: Kpi[] = [];

  const projetos = contagemDoRecorte(entregas?.projetos, ano);
  lista.push({
    rotulo: 'Projetos executados',
    valor: formatQuantidade(projetos.valor),
    nota: comSemData('inclui os em execução', projetos.semData),
    serie: serieDaContagem(entregas?.projetos),
  });

  const agentes = indicadores.find((i) => /agentes públicos/i.test(i.nome));
  if (agentes) {
    const v = valoresDoRecorte(agentes, ano);
    lista.push({
      rotulo: 'Agentes públicos engajados',
      valor: formatQuantidade(v.realizado),
      nota: `meta de ${formatQuantidade(v.meta)} · ${rotuloRecorte}`,
      meta: progresso(v.realizado, v.meta),
      serie: serieDoIndicador(agentes),
    });
  }

  const organizacoes = indicadores.find((i) => /^Organizações públicas/i.test(i.nome));
  if (organizacoes) {
    const v = valoresDoRecorte(organizacoes, ano);
    lista.push({
      rotulo: 'Organizações públicas atendidas',
      valor: formatQuantidade(v.realizado),
      nota: `meta de ${formatQuantidade(v.meta)} · ${rotuloRecorte}`,
      meta: progresso(v.realizado, v.meta),
      serie: serieDoIndicador(organizacoes),
    });
  }

  const indicadoresDeDesafio = indicadores.filter(
    (i) => i.unidade === 'quantidade' && /desafio/i.test(i.nome),
  );
  const desafios = indicadoresDeDesafio.reduce(
    (acc, ind) => {
      const v = valoresDoRecorte(ind, ano);
      return { meta: acc.meta + v.meta, realizado: acc.realizado + v.realizado };
    },
    { meta: 0, realizado: 0 },
  );
  if (desafios.meta > 0 || desafios.realizado > 0) {
    lista.push({
      rotulo: 'Desafios realizados',
      valor: formatQuantidade(desafios.realizado),
      nota: `customizados, autosserviço e de grande impacto · meta de ${formatQuantidade(desafios.meta)}`,
      meta: progresso(desafios.realizado, desafios.meta),
      serie: ANOS_PARCERIA.map((a) => ({
        ano: a,
        valor: indicadoresDeDesafio.reduce(
          (s, ind) => s + (ind.anos.find((x) => x.ano === a)?.realizado ?? 0),
          0,
        ),
      })),
    });
  }

  const solucoes = contagemDoRecorte(entregas?.solucoes, ano);
  lista.push({
    rotulo: 'Soluções geradas',
    valor: formatQuantidade(solucoes.valor),
    nota: comSemData('soluções enviadas aos desafios', solucoes.semData),
    serie: serieDaContagem(entregas?.solucoes),
  });

  const participantes = contagemDoRecorte(entregas?.participantesDesafios, ano);
  lista.push({
    rotulo: 'Participantes em desafios',
    valor: formatQuantidade(participantes.valor),
    nota: comSemData('inscritos nos desafios da Linha I', participantes.semData),
    serie: serieDaContagem(entregas?.participantesDesafios),
  });

  const indicadoresNps = indicadores.filter((i) => i.unidade === 'nps');
  const nps = indicadoresNps.map((i) => valoresDoRecorte(i, ano).realizado).filter((v) => v > 0);
  if (nps.length) {
    const media = nps.reduce((s, v) => s + v, 0) / nps.length;
    lista.push({
      rotulo: 'NPS médio',
      valor: formatQuantidade(Math.round(media * 10) / 10),
      nota: `média consolidada de ${nps.length} indicadores · meta 80`,
      meta: progresso(media, 80),
      serie: ANOS_PARCERIA.map((a) => {
        const doAno = indicadoresNps
          .map((i) => i.anos.find((x) => x.ano === a)?.realizado ?? 0)
          .filter((v) => v > 0);
        return {
          ano: a,
          valor: doAno.length ? doAno.reduce((s, v) => s + v, 0) / doAno.length : 0,
        };
      }),
    });
  }

  const premiacao = contagemDoRecorte(entregas?.premiacao, ano);
  lista.push({
    rotulo: 'Valor em premiação',
    valor: formatMoeda(premiacao.valor),
    nota: `pago aos desafios · ${rotuloRecorte}`,
    serie: serieDaContagem(entregas?.premiacao),
  });

  const captacao = indicadores.find((i) => i.unidade === 'moeda');
  if (captacao) {
    const v = valoresDoRecorte(captacao, ano);
    lista.push({
      rotulo: 'Recursos captados',
      valor: formatMoeda(v.realizado),
      nota:
        ano === null
          ? `meta de ${formatMoeda(captacao.metaTotal)} até 2028`
          : `meta de ${formatMoeda(v.meta)} · ${rotuloRecorte}`,
      meta: progresso(v.realizado, ano === null ? captacao.metaTotal : v.meta),
      serie: serieDoIndicador(captacao),
      destaque: true,
    });
  }

  // ROI do recorte, não o acumulado fixo: com 2025 selecionado, o card responde
  // pelo aporte e pela captação de 2025.
  const retorno = retornoDoRecorte(parceria, captacao, ano);
  if (retorno) {
    lista.push({
      rotulo: 'ROI da parceria',
      valor: retorno.roiPercentual === null ? '—' : formatPercentual(retorno.roiPercentual),
      nota:
        retorno.alavancagem === null
          ? `sem aporte registrado no recorte · ${rotuloRecorte}`
          : `${formatMoeda(retorno.alavancagem)} captados por R$ 1,00 aportado · ${rotuloRecorte}`,
      destaque: true,
    });
  }

  return lista;
}

function progresso(realizado: number, meta: number): Kpi['meta'] {
  if (!meta || meta <= 0) return undefined;
  const razao = (realizado / meta) * 100;
  return {
    pct: Math.min(razao, 100),
    rotulo: formatPercentual(Math.min(razao, 100)),
    atingido: razao >= 100,
  };
}

function serieDaContagem(c: ContagemPorAno | undefined): { ano: number; valor: number }[] {
  if (!c) return [];
  return ANOS_PARCERIA.map((ano) => ({ ano, valor: c.porAno[ano] ?? 0 }));
}

function serieDoIndicador(ind: Indicador): { ano: number; valor: number }[] {
  return ANOS_PARCERIA.map((ano) => ({
    ano,
    valor: ind.anos.find((a) => a.ano === ano)?.realizado ?? 0,
  }));
}

/** Registros sem data ficam fora do recorte anual; a nota diz quantos são. */
function comSemData(base: string, semData: number): string {
  return semData > 0 ? `${base} · ${formatQuantidade(semData)} sem data` : base;
}
