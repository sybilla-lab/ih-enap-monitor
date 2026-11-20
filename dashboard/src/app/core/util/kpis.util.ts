import {
  anosVisiveis,
  BancoSolucoes,
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

/** As fontes que os KPIs leem — cada uma de uma aba diferente da planilha. */
export interface FontesDosKpis {
  indicadores: Indicador[];
  entregas: EntregasOperacionais | null;
  solucoes: BancoSolucoes | null;
  parceria: ParceriaResumo | null;
}

/**
 * Os indicadores-chave da parceria, na ordem definida com o cliente.
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
  fontes: FontesDosKpis,
  ano: Recorte,
  rotuloRecorte: string,
): Kpi[] {
  const { indicadores, entregas, solucoes: banco, parceria } = fontes;
  const lista: Kpi[] = [];

  // "Projetos executados" saiu da lista a pedido do cliente. A contagem
  // continua sendo extraída da planilha (entregas.projetos) — se voltar, é só
  // reinserir o card aqui.

  const agentes = indicadores.find((i) => /agentes públicos/i.test(i.nome));
  if (agentes) {
    const v = valoresDoRecorte(agentes, ano);
    lista.push({
      rotulo: 'Agentes públicos engajados',
      valor: formatQuantidade(v.realizado),
      nota: `meta de ${formatQuantidade(v.meta)} · ${rotuloRecorte}`,
      meta: progresso(v.realizado, v.meta),
      serie: serieDoIndicador(agentes, formatQuantidade, ano),
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
      serie: serieDoIndicador(organizacoes, formatQuantidade, ano),
      detalhe: {
        calculo:
          'Realizado do indicador da Linha IV no recorte, comparado à meta do mesmo período. São organizações públicas engajadas em projetos na modalidade customizada.',
        fonte: `Aba "Metas", indicador "${organizacoes.nome.trim()}"`,
      },
    });
  }

  // Só a modalidade customizada (revisão 04). Antes o card somava as três
  // modalidades de desafio; autosserviço e grande impacto são contratos
  // diferentes e misturá-los inflava o número que o cliente usa para falar da
  // parceria. As outras duas continuam visíveis na página da Linha I.
  const customizados = indicadores.find(
    (i) => i.unidade === 'quantidade' && /desafios customizados/i.test(i.nome),
  );
  if (customizados) {
    const v = valoresDoRecorte(customizados, ano);
    lista.push({
      rotulo: 'Desafios customizados lançados',
      valor: formatQuantidade(v.realizado),
      nota: `meta de ${formatQuantidade(v.meta)} · ${rotuloRecorte}`,
      meta: progresso(v.realizado, v.meta),
      serie: serieDoIndicador(customizados, formatQuantidade, ano),
      detalhe: {
        calculo:
          'Realizado do indicador "Número de desafios customizados" da Linha I no recorte, contra a meta do mesmo período. Conta apenas a modalidade customizada: desafios de autosserviço da Plataforma Desafios e desafios de grande impacto são metas próprias e aparecem na página da Linha I.',
        fonte: `Aba "Metas", indicador "${customizados.nome.trim()}"`,
      },
    });
  }

  // Soluções e participantes vêm da aba "Soluções" (revisão 04), que é o
  // cadastro que o cliente acompanha. Ela não tem data: os dois números são o
  // acumulado do banco e não respondem ao recorte por ano — a nota diz isso,
  // em vez de o card mudar de valor sem o leitor entender por quê.
  if (banco && banco.solucoes.length) {
    const projetos = new Set(banco.solucoes.map((s) => s.projeto));
    lista.push({
      rotulo: 'Soluções geradas',
      valor: formatQuantidade(banco.solucoes.length),
      nota: 'soluções inscritas nos desafios · acumulado do banco',
      detalhe: {
        calculo:
          'Uma linha por solução na aba "Soluções" — o cadastro de tudo que o ecossistema submeteu aos desafios da parceria. A aba não traz data de inscrição, então o número é sempre o acumulado do banco: o filtro de ano não o altera.',
        fonte: 'Aba "Soluções", coluna "Nome do projeto/solução"',
        composicaoTitulo: 'Por projeto de origem',
        composicao: [...projetos]
          .map((projeto) => ({
            projeto,
            quantas: banco.solucoes.filter((s) => s.projeto === projeto).length,
          }))
          .sort((a, b) => b.quantas - a.quantas)
          .map((p) => ({ rotulo: p.projeto, valor: formatQuantidade(p.quantas) })),
      },
    });

    lista.push({
      rotulo: 'Participantes em desafios',
      valor: formatQuantidade(banco.participantes),
      nota: 'pessoas nas equipes das soluções · acumulado do banco',
      detalhe: {
        calculo:
          'Pessoas distintas nas equipes responsáveis pelas soluções da aba "Soluções". A mesma equipe se inscreve em mais de um desafio, então a contagem é por pessoa (chave: o e-mail, ou o nome quando não há e-mail) e não por linha da planilha. Como a aba não tem data, o número é o acumulado do banco e não responde ao filtro de ano.',
        fonte: 'Aba "Soluções", colunas "Responsável" e "E-mail"',
      },
    });
  }

  const indicadoresNps = indicadores.filter((i) => i.unidade === 'nps');
  const nps = indicadoresNps.map((i) => valoresDoRecorte(i, ano).realizado).filter((v) => v > 0);
  if (nps.length) {
    const media = nps.reduce((s, v) => s + v, 0) / nps.length;
    lista.push({
      rotulo: 'NPS médio',
      valor: formatQuantidade(Math.round(media * 10) / 10),
      nota: `média consolidada de ${nps.length} indicadores · meta 80`,
      meta: progresso(media, 80),
      serie: anosVisiveis(ano).map((a) => {
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
    serie: serieDaContagem(entregas?.premiacao, formatMoeda, ano),
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
      serie: serieDoIndicador(captacao, formatMoeda, ano),
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
  recorte: Recorte,
): PontoSerie[] {
  if (!c) return [];
  return anosVisiveis(recorte).map((ano) => {
    const valor = c.porAno[ano] ?? 0;
    return { ano, valor, rotulo: valor ? formatar(valor) : '—' };
  });
}

function serieDoIndicador(
  ind: Indicador,
  formatar: (v: number) => string,
  recorte: Recorte,
): PontoSerie[] {
  return anosVisiveis(recorte).map((ano) => {
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
