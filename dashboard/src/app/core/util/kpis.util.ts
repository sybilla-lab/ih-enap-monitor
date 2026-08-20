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

export interface PontoSerie {
  ano: number;
  valor: number;
  /** Meta pactuada para o ano, quando o indicador tem uma. */
  meta?: number;
  rotulo: string;
  rotuloMeta?: string;
}

/**
 * O que o detalhe do KPI abre: de onde o número vem, como é obtido e, quando
 * ele é a soma ou a média de outros, quais são esses outros.
 *
 * Existe para o leitor conseguir auditar o painel sem abrir a planilha — foi o
 * pedido de "clareza e transparência".
 */
export interface KpiDetalhe {
  calculo: string;
  fonte: string;
  composicao?: { rotulo: string; valor: string; nota?: string }[];
  /** Rótulo do que a composição soma/mediana ("Somados" / "Média de"). */
  composicaoTitulo?: string;
}

export interface Kpi {
  rotulo: string;
  valor: string;
  nota: string;
  /** Progresso contra a meta do recorte, quando o indicador tem meta. */
  meta?: { pct: number; rotulo: string; atingido: boolean };
  /** Série anual — gráfico miúdo no card e gráfico cheio no detalhe. */
  serie?: PontoSerie[];
  /** Card em destaque na grade (o que a leitura procura primeiro). */
  destaque?: boolean;
  detalhe: KpiDetalhe;
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
    serie: serieDaContagem(entregas?.projetos, formatQuantidade),
    detalhe: {
      calculo:
        'Contagem de iniciativas distintas registradas nas abas de atividades. Uma iniciativa com várias atividades (oficinas, encontros, etapas) conta uma vez só. O ano vem da data inicial ou final do registro.',
      fonte: 'Abas "Linha I Desafios", "Linha II Aceleracao" e "Linha III - Comunidade e Cultura"',
    },
  });

  const agentes = indicadores.find((i) => /agentes públicos/i.test(i.nome));
  if (agentes) {
    const v = valoresDoRecorte(agentes, ano);
    lista.push({
      rotulo: 'Agentes públicos engajados',
      valor: formatQuantidade(v.realizado),
      nota: `meta de ${formatQuantidade(v.meta)} · ${rotuloRecorte}`,
      meta: progresso(v.realizado, v.meta),
      serie: serieDoIndicador(agentes, formatQuantidade),
      detalhe: {
        calculo:
          'Realizado do indicador da Linha I no recorte, comparado à meta pactuada para o mesmo período. Sem recorte, usa o total acumulado (YTD) e a meta total da parceria.',
        fonte: `Aba "Metas", indicador "${agentes.nome.trim()}"`,
      },
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
      serie: serieDoIndicador(organizacoes, formatQuantidade),
      detalhe: {
        calculo:
          'Realizado do indicador da Linha IV no recorte, comparado à meta do mesmo período. São organizações públicas engajadas em projetos na modalidade customizada.',
        fonte: `Aba "Metas", indicador "${organizacoes.nome.trim()}"`,
      },
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
      serie: ANOS_PARCERIA.map((a) => {
        const valor = indicadoresDeDesafio.reduce(
          (s, ind) => s + (ind.anos.find((x) => x.ano === a)?.realizado ?? 0),
          0,
        );
        const meta = indicadoresDeDesafio.reduce(
          (s, ind) => s + (ind.anos.find((x) => x.ano === a)?.meta ?? 0),
          0,
        );
        return {
          ano: a,
          valor,
          meta,
          rotulo: formatQuantidade(valor),
          rotuloMeta: formatQuantidade(meta),
        };
      }),
      detalhe: {
        calculo:
          'Soma dos indicadores de desafios da aba Metas no recorte. São três modalidades distintas, contadas juntas porque a pergunta do cliente é "quantos desafios a parceria já realizou".',
        fonte: 'Aba "Metas", Linha I',
        composicaoTitulo: 'Somados neste número',
        composicao: indicadoresDeDesafio.map((ind) => {
          const v = valoresDoRecorte(ind, ano);
          return {
            rotulo: ind.nome.trim(),
            valor: formatQuantidade(v.realizado),
            nota: v.meta > 0 ? `meta de ${formatQuantidade(v.meta)}` : 'sem meta no recorte',
          };
        }),
      },
    });
  }

  const solucoes = contagemDoRecorte(entregas?.solucoes, ano);
  lista.push({
    rotulo: 'Soluções geradas',
    valor: formatQuantidade(solucoes.valor),
    nota: comSemData('soluções enviadas aos desafios', solucoes.semData),
    serie: serieDaContagem(entregas?.solucoes, formatQuantidade),
    detalhe: {
      calculo:
        'Soma da coluna "Soluções enviadas" dos desafios da Linha I. Conta o que as equipes submeteram aos desafios — não é o mesmo que o Banco de Soluções, que reúne o ecossistema todo e contém duplicatas declaradas na própria planilha.',
      fonte: 'Aba "Linha I Desafios", coluna "SOLUÇÕES ENVIADAS"',
    },
  });

  const participantes = contagemDoRecorte(entregas?.participantesDesafios, ano);
  lista.push({
    rotulo: 'Participantes em desafios',
    valor: formatQuantidade(participantes.valor),
    nota: comSemData('inscritos nos desafios da Linha I', participantes.semData),
    serie: serieDaContagem(entregas?.participantesDesafios, formatQuantidade),
    detalhe: {
      calculo:
        'Soma dos inscritos declarados em cada desafio da Linha I. Registros de atividade sem número de inscritos não entram na conta.',
      fonte: 'Aba "Linha I Desafios", coluna "TOTAL DE PARTICIPANTES INSCRITOS"',
    },
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
        const valor = doAno.length ? doAno.reduce((s, v) => s + v, 0) / doAno.length : 0;
        return {
          ano: a,
          valor,
          meta: 80,
          rotulo: valor ? formatQuantidade(Math.round(valor * 10) / 10) : '—',
          rotuloMeta: '80',
        };
      }),
      detalhe: {
        calculo:
          'Média simples dos indicadores de NPS que têm resultado no recorte. NPS não se soma nem se acumula: com mais de um ano selecionado, cada indicador entra pela média dos seus anos.',
        fonte: 'Aba "Metas", indicadores de Net Promoter Score das Linhas I, II e III',
        composicaoTitulo: 'Média destes indicadores',
        composicao: indicadoresNps.map((ind) => {
          const v = valoresDoRecorte(ind, ano);
          return {
            rotulo: ind.nome.trim(),
            valor: v.realizado > 0 ? formatQuantidade(Math.round(v.realizado * 10) / 10) : '—',
            nota: v.realizado > 0 ? `${ind.linha} · meta 80` : `${ind.linha} · sem apuração`,
          };
        }),
      },
    });
  }

  const premiacao = contagemDoRecorte(entregas?.premiacao, ano);
  lista.push({
    rotulo: 'Valor em premiação',
    valor: formatMoeda(premiacao.valor),
    nota: `pago aos desafios · ${rotuloRecorte}`,
    serie: serieDaContagem(entregas?.premiacao, formatMoeda),
    detalhe: {
      calculo:
        'Total geral de premiação por ano, como a própria planilha consolida no resumo da aba — soma dos recursos da União e dos externos.',
      fonte: 'Aba "LIV - Premiação", resumo "Ano · Total Geral"',
    },
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
      serie: serieDoIndicador(captacao, formatMoeda),
      destaque: true,
      detalhe: {
        calculo:
          'Valor captado de fontes públicas, privadas e internacionais, fora do orçamento da União. Sem recorte, o painel usa o realizado acumulado (YTD) contra a meta total de 2028.',
        fonte: 'Aba "Metas", indicador financeiro da Linha IV',
      },
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
      detalhe: {
        calculo:
          'Retorno líquido dividido pelo aporte do recorte: (captado − aporte) ÷ aporte. Os textos narrativos da planilha não são usados como fonte — envelhecem sem ser atualizados.',
        fonte: 'Aba "Parceria" (aportes anuais) e indicador financeiro da Linha IV (captação)',
        composicaoTitulo: 'Como se chega ao número',
        composicao: [
          { rotulo: 'Aporte da Enap no recorte', valor: formatMoeda(retorno.aporte) },
          { rotulo: 'Captado de fontes externas', valor: formatMoeda(retorno.captado) },
          { rotulo: 'Retorno líquido', valor: formatMoeda(retorno.liquido), nota: 'captado − aporte' },
        ],
      },
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

function serieDaContagem(
  c: ContagemPorAno | undefined,
  formatar: (v: number) => string,
): PontoSerie[] {
  if (!c) return [];
  return ANOS_PARCERIA.map((ano) => {
    const valor = c.porAno[ano] ?? 0;
    return { ano, valor, rotulo: valor ? formatar(valor) : '—' };
  });
}

function serieDoIndicador(ind: Indicador, formatar: (v: number) => string): PontoSerie[] {
  return ANOS_PARCERIA.map((ano) => {
    const doAno = ind.anos.find((a) => a.ano === ano);
    const valor = doAno?.realizado ?? 0;
    const meta = doAno?.meta ?? 0;
    return {
      ano,
      valor,
      meta,
      rotulo: valor || meta ? formatar(valor) : '—',
      rotuloMeta: meta ? formatar(meta) : undefined,
    };
  });
}

/** Registros sem data ficam fora do recorte anual; a nota diz quantos são. */
function comSemData(base: string, semData: number): string {
  return semData > 0 ? `${base} · ${formatQuantidade(semData)} sem data` : base;
}
