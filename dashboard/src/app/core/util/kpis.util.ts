import {
  EntregasOperacionais,
  Indicador,
  ParceriaResumo,
} from '../models/indicadores.model';
import { contagemDoRecorte, valoresDoRecorte } from './agregacao.util';
import { formatMoeda, formatPercentual, formatQuantidade } from './numero.util';

export interface Kpi {
  rotulo: string;
  valor: string;
  nota: string;
}

/**
 * Os dez indicadores-chave da parceria, na ordem definida com o cliente.
 *
 * Vive aqui, e não na Home, porque o Relatório Executivo precisa exatamente da
 * mesma lista: se cada tela montasse a sua, um dia o PDF diria um número e a
 * página diria outro. Cada KPI declara a origem na nota — vários não estão na
 * aba Metas e vêm das abas operacionais.
 */
export function kpisDaParceria(
  indicadores: Indicador[],
  entregas: EntregasOperacionais | null,
  parceria: ParceriaResumo | null,
  ano: number | null,
  rotuloRecorte: string,
): Kpi[] {
  const lista: Kpi[] = [];

  const projetos = contagemDoRecorte(entregas?.projetos, ano);
  lista.push({
    rotulo: 'Projetos executados',
    valor: formatQuantidade(projetos.valor),
    nota: comSemData('inclui os em execução', projetos.semData),
  });

  const agentes = indicadores.find((i) => /agentes públicos/i.test(i.nome));
  if (agentes) {
    const v = valoresDoRecorte(agentes, ano);
    lista.push({
      rotulo: 'Agentes públicos engajados',
      valor: formatQuantidade(v.realizado),
      nota: `meta de ${formatQuantidade(v.meta)} · ${rotuloRecorte}`,
    });
  }

  const organizacoes = indicadores.find((i) => /^Organizações públicas/i.test(i.nome));
  if (organizacoes) {
    const v = valoresDoRecorte(organizacoes, ano);
    lista.push({
      rotulo: 'Organizações públicas atendidas',
      valor: formatQuantidade(v.realizado),
      nota: `meta de ${formatQuantidade(v.meta)} · ${rotuloRecorte}`,
    });
  }

  const desafios = indicadores
    .filter((i) => i.unidade === 'quantidade' && /desafio/i.test(i.nome))
    .reduce(
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
    });
  }

  const solucoes = contagemDoRecorte(entregas?.solucoes, ano);
  lista.push({
    rotulo: 'Soluções geradas',
    valor: formatQuantidade(solucoes.valor),
    nota: comSemData('soluções enviadas aos desafios', solucoes.semData),
  });

  const participantes = contagemDoRecorte(entregas?.participantesDesafios, ano);
  lista.push({
    rotulo: 'Participantes em desafios',
    valor: formatQuantidade(participantes.valor),
    nota: comSemData('inscritos nos desafios da Linha I', participantes.semData),
  });

  const nps = indicadores
    .filter((i) => i.unidade === 'nps')
    .map((i) => valoresDoRecorte(i, ano).realizado)
    .filter((v) => v > 0);
  if (nps.length) {
    lista.push({
      rotulo: 'NPS médio',
      valor: formatQuantidade(Math.round((nps.reduce((s, v) => s + v, 0) / nps.length) * 10) / 10),
      nota: `média consolidada de ${nps.length} indicadores · meta 80`,
    });
  }

  const premiacao = contagemDoRecorte(entregas?.premiacao, ano);
  lista.push({
    rotulo: 'Valor em premiação',
    valor: formatMoeda(premiacao.valor),
    nota: `pago aos desafios · ${rotuloRecorte}`,
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
          : `meta de ${formatMoeda(v.meta)} para ${ano}`,
    });
  }

  if (parceria) {
    lista.push({
      rotulo: 'ROI da parceria',
      valor: formatPercentual(parceria.roiPercentual),
      nota: `${formatMoeda(parceria.alavancagem)} captados por R$ 1,00 aportado · acumulado`,
    });
  }

  return lista;
}

/** Registros sem data ficam fora do recorte anual; a nota diz quantos são. */
function comSemData(base: string, semData: number): string {
  return semData > 0 ? `${base} · ${formatQuantidade(semData)} sem data` : base;
}
