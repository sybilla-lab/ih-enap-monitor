import type * as XLSX from 'xlsx';
import {
  ANOS_PARCERIA,
  AportePorAno,
  ContagemPorAno,
  EntregasOperacionais,
  EscalaDesafios,
  Indicador,
  LinhaAcaoId,
  MetaAnual,
  ParceriaResumo,
  UnidadeIndicador,
} from '../models/indicadores.model';
import {
  RegistroAgente,
  RegistroAlcance,
  RegistroOrganizacao,
  TerritorioBruto,
} from '../models/territorio.model';
import { parseNumero } from '../util/numero.util';

/**
 * Leitura da Planilha Oficial de Indicadores no próprio navegador.
 *
 * O painel não guarda dados: o arquivo .xlsx é escolhido pela pessoa que abre o
 * dashboard, lido em memória aqui e nunca sai da máquina dela — nenhuma
 * requisição de rede, nenhum arquivo no repositório. Enquanto não existir
 * backend, é isto que permite publicar o código sem publicar os dados.
 *
 * Este módulo é o ÚNICO lugar que conhece o formato da planilha. Cada aba é
 * localizada pelo nome e cada coluna pelo texto do cabeçalho — exportações
 * diferentes trazem números diferentes de linhas/colunas em branco, e posição
 * fixa quebrava o painel a cada atualização da fonte.
 */
export interface DadosPainel {
  arquivo: string;
  lidoEm: string;
  indicadores: Indicador[];
  parceria: ParceriaResumo | null;
  territorio: TerritorioBruto;
  entregas: EntregasOperacionais;
}

export class PlanilhaInvalidaError extends Error {
  constructor(public readonly faltando: string[]) {
    super(
      `A planilha não tem ${faltando.length === 1 ? 'a aba' : 'as abas'} ${faltando.join(', ')}.`,
    );
    this.name = 'PlanilhaInvalidaError';
  }
}

const ABAS_OBRIGATORIAS = ['Metas', 'Parceria'];

export async function lerPlanilha(arquivo: File): Promise<DadosPainel> {
  // Carregado sob demanda: o leitor de xlsx é grande e só faz sentido depois
  // que a pessoa escolhe um arquivo.
  const XLSXlib = await import('xlsx');
  const wb = XLSXlib.read(await arquivo.arrayBuffer(), { type: 'array' });

  const nomeDaAba = (nome: string) => wb.SheetNames.find((n) => n.trim() === nome.trim());
  const faltando = ABAS_OBRIGATORIAS.filter((n) => !nomeDaAba(n));
  if (faltando.length) throw new PlanilhaInvalidaError(faltando);

  /** Linhas da aba como matriz de texto já formatado (é o que revela % e R$). */
  const linhas = (nome: string): string[][] => {
    const aba = nomeDaAba(nome);
    if (!aba) return [];
    return XLSXlib.utils.sheet_to_json<string[]>(wb.Sheets[aba], {
      header: 1,
      raw: false,
      defval: '',
    });
  };

  return {
    arquivo: arquivo.name,
    lidoEm: new Date().toISOString(),
    indicadores: lerMetas(linhas('Metas')),
    parceria: lerParceria(linhas('Parceria')),
    territorio: lerTerritorio(linhas),
    entregas: lerEntregas(linhas),
  };
}

// --------------------------------------------------------------- Metas ----

/**
 * Aba "Metas": uma linha por indicador com Meta/Realizado por ano (2024–2028)
 * mais Meta Total e Realizado (YTD). O cabeçalho não está na primeira linha e
 * há linhas de rascunho no rodapé — por isso a âncora textual e o filtro.
 */
function lerMetas(rows: string[][]): Indicador[] {
  let header = -1;
  let col = -1;
  for (let i = 0; i < rows.length && header < 0; i++) {
    const j = rows[i].findIndex((c) => (c ?? '').trim() === 'Linha de Ação');
    if (j >= 0) {
      header = i;
      col = j;
    }
  }
  if (header < 0) return [];

  const indicadores: Indicador[] = [];
  for (const row of rows.slice(header + 1)) {
    const linha = (row[col] ?? '').trim() as LinhaAcaoId;
    const nome = (row[col + 1] ?? '').trim();
    if (!linha.startsWith('Linha') || !nome) continue;

    const anos: MetaAnual[] = ANOS_PARCERIA.map((ano, i) => ({
      ano,
      meta: parseNumero(row[col + 2 + i * 2]),
      realizado: parseNumero(row[col + 3 + i * 2]),
    }));

    indicadores.push({
      linha,
      nome,
      unidade: detectarUnidade(nome, row.slice(col + 2, col + 14)),
      anos,
      metaTotal: parseNumero(row[col + 12]),
      realizadoTotal: parseNumero(row[col + 13]),
    });
  }
  return indicadores;
}

/** A unidade vem da formatação que a planilha exibe ("30%", "R$ 17.550.525,00"). */
function detectarUnidade(nome: string, valoresDaLinha: string[]): UnidadeIndicador {
  if (/NPS/i.test(nome)) return 'nps';
  const valores = valoresDaLinha.join(' ');
  if (valores.includes('%')) return 'percentual';
  if (valores.includes('R$') || /\(R\$\)/.test(nome)) return 'moeda';
  return 'quantidade';
}

// ------------------------------------------------------------ Parceria ----

/**
 * Aba "Parceria": layout livre. O investimento é a soma das entradas anuais e
 * os demais números são derivados dele + do valor captado, em vez de raspados
 * das células de texto — a narrativa dessa aba envelhece sem ser atualizada.
 */
function lerParceria(rows: string[][]): ParceriaResumo | null {
  const aportes: AportePorAno[] = [];
  let captado = 0;
  for (const row of rows) {
    const ano = (row[0] ?? '').trim();
    if (/^20\d{2}$/.test(ano)) aportes.push({ ano: Number(ano), valor: parseNumero(row[1]) });
    const idx = row.findIndex((c) => (c ?? '').trim().startsWith('Valor captador'));
    if (idx >= 0) captado = parseNumero(row[idx + 1]);
  }
  const investimento = aportes.reduce((s, a) => s + a.valor, 0);
  if (!investimento || !captado) return null;

  const retorno = captado - investimento;
  return {
    investimentoInicial: investimento,
    valorCaptado: captado,
    retornoLiquido: retorno,
    roiPercentual: (retorno / investimento) * 100,
    alavancagem: captado / investimento,
    aportes,
    escalaDesafios: lerEscalaDesafios(rows),
  };
}

/** Bloco solto no rodapé da aba: meta global de desafios × projeção de alcance. */
function lerEscalaDesafios(rows: string[][]): EscalaDesafios | null {
  const cabecalho = rows.findIndex((r) => (r[0] ?? '').trim().startsWith('Meta Global'));
  if (cabecalho < 0) return null;
  const valores = rows[cabecalho + 1];
  if (!valores) return null;

  const meta = parseNumero(valores[0]);
  const projecao = parseNumero(valores[1]);
  if (!meta || !projecao) return null;
  return { meta, projecao, nota: (valores[2] ?? '').trim() };
}

// -------------------------------------------------- Entregas (KPIs Home) ----

function contagemVazia(): ContagemPorAno {
  return { total: 0, porAno: {}, semData: 0 };
}

function somar(c: ContagemPorAno, valor: number, ano: number | null): void {
  if (!valor) return;
  c.total += valor;
  if (ano === null) c.semData += valor;
  else c.porAno[ano] = (c.porAno[ano] ?? 0) + valor;
}

/**
 * Números de entrega que a aba Metas não cobre.
 *
 * Todos saem das abas operacionais e por isso trazem também o ano de cada
 * registro — sem isso o KPI não responderia ao filtro. Registros sem data
 * entram no acumulado e ficam fora dos recortes anuais, sempre declarados.
 */
function lerEntregas(linhas: (nome: string) => string[][]): EntregasOperacionais {
  const projetos = contagemVazia();
  const solucoes = contagemVazia();
  const participantes = contagemVazia();
  const premiacao = contagemVazia();

  /** Projetos distintos: a mesma iniciativa aparece em várias linhas de atividade. */
  const contarProjetos = (aba: string, reNome: RegExp, reData: RegExp) => {
    const rows = linhas(aba);
    const hIdx = rows.findIndex((r) => r.some((c) => /LINHA DE A[ÇC]/i.test((c ?? '').trim())));
    if (hIdx < 0) return;
    const h = rows[hIdx];
    const iNome = coluna(h, reNome);
    const iDi = coluna(h, reData);
    const iDf = iDi + 1; // DATA FINAL vem sempre logo depois de DATA INICIAL
    if (iNome < 0) return;

    const vistos = new Set<string>();
    for (const row of rows.slice(hIdx + 1)) {
      const nome = (row[iNome] ?? '').trim();
      if (!nome || vistos.has(nome)) continue;
      vistos.add(nome);
      somar(projetos, 1, anoDasDatas(row[iDi] ?? '', row[iDf] ?? ''));
    }
  };
  contarProjetos('Linha I Desafios', /NOME DA INICIATIVA/i, /DATA INICIAL/i);
  contarProjetos('Linha II Aceleracao', /^PROJETO/i, /DATA INICIAL/i);
  contarProjetos('Linha III - Comunidade e Cultur', /^PROJETO/i, /DATA INICIAL/i);

  // Soluções e participantes vêm das colunas de resultado dos desafios (Linha I).
  {
    const rows = linhas('Linha I Desafios');
    const hIdx = rows.findIndex((r) => r.some((c) => /LINHA DE A[ÇC]/i.test((c ?? '').trim())));
    if (hIdx >= 0) {
      const h = rows[hIdx];
      const iSolucoes = coluna(h, /SOLU[ÇC][ÕO]ES ENVIADAS/i);
      const iInscritos = coluna(h, /TOTAL DE PARTICIPANTES INSCRITOS/i);
      const iDi = coluna(h, /DATA INICIAL/i);
      for (const row of rows.slice(hIdx + 1)) {
        const ano = anoDasDatas(row[iDi] ?? '', row[iDi + 1] ?? '');
        if (iSolucoes >= 0) somar(solucoes, parseNumero(row[iSolucoes]), ano);
        if (iInscritos >= 0) somar(participantes, parseNumero(row[iInscritos]), ano);
      }
    }
  }

  // Premiação: a aba LIV traz um resumo "Ano | Total Geral" à direita do
  // detalhamento — é o número que o cliente acompanha, então é o usado aqui.
  {
    const rows = linhas('LIV - Premiação');
    const hIdx = rows.findIndex((r) => r.some((c) => /^Total Geral$/i.test((c ?? '').trim())));
    if (hIdx >= 0) {
      const iTotal = coluna(rows[hIdx], /^Total Geral$/i);
      const iAno = iTotal - 1;
      for (const row of rows.slice(hIdx + 1)) {
        const ano = (row[iAno] ?? '').trim();
        if (/^20\d{2}$/.test(ano)) somar(premiacao, parseNumero(row[iTotal]), Number(ano));
      }
    }
  }

  return { projetos, solucoes, participantesDesafios: participantes, premiacao };
}

// --------------------------------------------------------- Territorial ----

const UFS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

const normalizar = (s: string) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const SIGLA_POR_NOME = new Map(
  Object.entries(UFS).map(([sigla, nome]) => [normalizar(nome), sigla]),
);

/** Converte um token ("SP", "São Paulo ", "são paulo") na sigla, ou null. */
function tokenParaUf(token: string): string | null {
  const t = (token ?? '').trim();
  if (!t) return null;
  const up = t.toUpperCase();
  if (UFS[up]) return up;
  return SIGLA_POR_NOME.get(normalizar(t)) ?? null;
}

/** Primeiro ano de quatro dígitos nas datas da linha; null quando só há dd/mm. */
function anoDasDatas(...datas: string[]): number | null {
  const m = datas.join(' ').match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

function coluna(header: string[], re: RegExp): number {
  return header.findIndex((c) => re.test((c ?? '').trim()));
}

function lerTerritorio(linhas: (nome: string) => string[][]): TerritorioBruto {
  const alcance: RegistroAlcance[] = [];

  const coletarEstados = (aba: string, reIniciativa: RegExp, linha: LinhaAcaoId) => {
    const rows = linhas(aba);
    const hIdx = rows.findIndex((r) => r.some((c) => /LINHA DE A[ÇC]/i.test((c ?? '').trim())));
    if (hIdx < 0) return;
    const h = rows[hIdx];
    const iEst = coluna(h, /^ESTADOS$/i);
    const iIni = coluna(h, reIniciativa);
    const iDi = coluna(h, /DATA INICIAL/i);
    const iDf = coluna(h, /DATA FINAL/i);
    if (iEst < 0 || iIni < 0) return;

    for (const row of rows.slice(hIdx + 1)) {
      const estados = (row[iEst] ?? '').trim();
      if (!estados) continue;
      const iniciativa = (row[iIni] ?? '').trim() || 'sem-nome';
      const ano = anoDasDatas(row[iDi] ?? '', row[iDf] ?? '');
      for (const token of estados.split(/[,;/]/)) {
        const uf = tokenParaUf(token);
        if (uf) alcance.push({ uf, iniciativa, linha, ano });
      }
    }
  };
  coletarEstados('Linha I Desafios', /NOME DA INICIATIVA/i, 'Linha I');
  coletarEstados('Linha II Aceleracao', /^PROJETO/i, 'Linha II');

  // Agentes públicos: instituição, projeto, UF e ano. Nome e e-mail ficam na
  // planilha — o painel conta pessoas, não as identifica.
  const agentes: RegistroAgente[] = [];
  {
    const rows = linhas('LI - Agentes Públicos');
    const hIdx = rows.findIndex((r) => /^Projeto$/i.test((r[0] ?? '').trim()));
    if (hIdx >= 0) {
      const h = rows[hIdx];
      const iProjeto = coluna(h, /^Projeto$/i);
      const iPessoa = coluna(h, /^Nome$/i);
      const iInst = coluna(h, /Institui[çc][ãa]o/i);
      const iAno = coluna(h, /^Ano$/i);
      for (const row of rows.slice(hIdx + 1)) {
        const pessoa = (row[iPessoa] ?? '').trim();
        const instituicao = (row[iInst] ?? '').trim();
        if (!pessoa || !instituicao) continue;
        const m = instituicao.match(/Prefeitura d[eo]s?\s+(.+?)\s*\(([A-Z]{2})\)/i);
        const uf = m && UFS[m[2].toUpperCase()] ? m[2].toUpperCase() : null;
        agentes.push({
          instituicao,
          projeto: (row[iProjeto] ?? '').trim() || 'Projeto não informado',
          uf,
          cidade: uf && m ? m[1].trim() : null,
          linha: 'Linha I',
          ano: Number((row[iAno] ?? '').trim()) || null,
        });
      }
    }
  }

  const organizacoes: RegistroOrganizacao[] = [];
  {
    const rows = linhas('LIV - Organizações públicas');
    const hIdx = rows.findIndex((r) => /^Nome da institui[çc][ãa]o$/i.test((r[0] ?? '').trim()));
    if (hIdx >= 0) {
      const h = rows[hIdx];
      const iNome = coluna(h, /^Nome da institui[çc][ãa]o$/i);
      const iNivel = coluna(h, /N[íi]vel federativo/i);
      const iEngajamento = coluna(h, /^Engajamento$/i);
      const iAno = coluna(h, /^Ano$/i);
      for (const row of rows.slice(hIdx + 1)) {
        const nome = (row[iNome] ?? '').trim();
        if (!nome) continue;
        organizacoes.push({
          nome,
          nivel: (row[iNivel] ?? '').trim() || 'Não informado',
          engajamento: (row[iEngajamento] ?? '').trim(),
          linha: 'Linha IV',
          ano: Number((row[iAno] ?? '').trim()) || null,
        });
      }
    }
  }

  return {
    atualizadoEm: new Date().toISOString().slice(0, 10),
    totalUfs: 27,
    alcance,
    agentes,
    organizacoes,
  };
}

/** Tipo re-exportado só para o serviço declarar o retorno sem importar xlsx. */
export type Planilha = XLSX.WorkBook;
