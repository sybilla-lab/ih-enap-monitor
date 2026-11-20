import type * as XLSX from 'xlsx';
import {
  ANOS_PARCERIA,
  AportePorAno,
  BancoSolucoes,
  Comunicacao,
  MesComunicacao,
  MetricaComunicacao,
  ContagemPorAno,
  EntregasOperacionais,
  EscalaDesafios,
  EventoLinhaIII,
  Indicador,
  LinhaAcaoId,
  MetaAnual,
  ParceriaResumo,
  Solucao,
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
/**
 * Muda sempre que o formato de `DadosPainel` muda. A sessão guardada de uma
 * versão anterior não tem os campos novos (foi assim que a página de
 * Comunicação apareceu vazia com a planilha certa carregada): em vez de exibir
 * meio painel, o app descarta o que guardou e pede a planilha de novo.
 */
export const VERSAO_DADOS = 3;

export interface DadosPainel {
  versao: number;
  arquivo: string;
  lidoEm: string;
  indicadores: Indicador[];
  parceria: ParceriaResumo | null;
  territorio: TerritorioBruto;
  entregas: EntregasOperacionais;
  comunicacao: Comunicacao;
  solucoes: BancoSolucoes;
  eventos: EventoLinhaIII[];
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

  // Nome exato quando se sabe o nome, expressão quando não: o Excel corta o
  // nome da aba em 31 caracteres ("LIII - Eventos, oficinas e SI + NPS" chega
  // truncado) e o cliente renomeia abas entre exportações.
  const nomeDaAba = (nome: string | RegExp) =>
    typeof nome === 'string'
      ? wb.SheetNames.find((n) => n.trim() === nome.trim())
      : wb.SheetNames.find((n) => nome.test(n.trim()));
  const faltando = ABAS_OBRIGATORIAS.filter((n) => !nomeDaAba(n));
  if (faltando.length) throw new PlanilhaInvalidaError(faltando);

  /** Linhas da aba como matriz de texto já formatado (é o que revela % e R$). */
  const linhas = (nome: string | RegExp): string[][] => {
    const aba = nomeDaAba(nome);
    if (!aba) return [];
    return XLSXlib.utils.sheet_to_json<string[]>(wb.Sheets[aba], {
      header: 1,
      raw: false,
      defval: '',
    });
  };

  return {
    versao: VERSAO_DADOS,
    arquivo: arquivo.name,
    lidoEm: new Date().toISOString(),
    indicadores: lerMetas(linhas('Metas')),
    parceria: lerParceria(linhas('Parceria')),
    territorio: lerTerritorio(linhas),
    entregas: lerEntregas(linhas),
    comunicacao: lerComunicacao(linhas),
    solucoes: lerSolucoes(linhas),
    eventos: lerEventos(linhas),
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
 *
 * Soluções e participantes saíram daqui na revisão 04: passaram a ser contados
 * no Banco de Soluções (`lerSolucoes`), que é a fonte que o cliente acompanha.
 */
function lerEntregas(linhas: (nome: string | RegExp) => string[][]): EntregasOperacionais {
  const projetos = contagemVazia();
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

  return { projetos, premiacao };
}

// -------------------------------------------------------- Comunicação ----

/**
 * Aba "Comunicação - Números": uma linha por mês, uma coluna por métrica.
 *
 * As métricas são lidas do cabeçalho, não fixadas no código — a equipe de
 * comunicação vai acrescentar colunas e anos, e o painel deve passar a mostrar
 * o que for acrescentado sem precisar de alteração aqui. Meses ainda em branco
 * (o resto do ano) são ignorados.
 */
function lerComunicacao(linhas: (nome: string) => string[][]): Comunicacao {
  const rows = linhas('Comunicação - Números');

  // Acha linha E coluna de "Período": a aba pode vir com colunas ou linhas em
  // branco à esquerda/acima, e assumir a célula A1 fazia a página inteira
  // aparecer vazia mesmo com a planilha preenchida.
  let hIdx = -1;
  let colPeriodo = -1;
  for (let i = 0; i < rows.length && hIdx < 0; i++) {
    const j = rows[i].findIndex((c) => /^per[íi]odo$/i.test((c ?? '').trim()));
    if (j >= 0) {
      hIdx = i;
      colPeriodo = j;
    }
  }
  if (hIdx < 0) return { meses: [], metricas: [] };

  // O nome das métricas pode estar na mesma linha do "Período" ou na de cima —
  // o cabeçalho da aba é alto e às vezes quebra em duas linhas na planilha.
  const nomear = (linha: string[] | undefined) =>
    (linha ?? [])
      .map((c, i) => ({ rotulo: (c ?? '').trim(), i }))
      .filter((c) => c.i > colPeriodo && c.rotulo);

  let colunas = nomear(rows[hIdx]);
  if (!colunas.length) colunas = nomear(rows[hIdx - 1]);
  if (!colunas.length) return { meses: [], metricas: [] };

  const meses: MesComunicacao[] = [];
  for (const row of rows.slice(hIdx + 1)) {
    const periodo = (row[colPeriodo] ?? '').trim();
    // Aceita "01/2026" e também datas completas ("01/01/2026"), que é como o
    // Excel devolve quando a célula do período é do tipo data.
    const m = periodo.match(/^(?:\d{1,2}\/)?(\d{1,2})\/(20\d{2})$/);
    if (!m) continue; // pula a linha de totais no rodapé

    const valores: Record<string, number> = {};
    let soma = 0;
    for (const col of colunas) {
      const bruto = (row[col.i] ?? '').trim();
      if (!bruto) continue;
      const valor = parseNumero(bruto);
      valores[col.rotulo] = valor;
      soma += valor;
    }
    // Mês zerado é mês que ainda não aconteceu — a planilha já traz o ano
    // inteiro com os meses futuros em branco ou com zero, e exibi-los só
    // encolhe as barras do que de fato aconteceu.
    if (soma > 0) meses.push({ periodo, ano: Number(m[2]), mes: Number(m[1]), valores });
  }

  const metricas: MetricaComunicacao[] = colunas.map((col) => {
    const porMes: Record<string, number> = {};
    let total = 0;
    for (const mes of meses) {
      const v = mes.valores[col.rotulo] ?? 0;
      porMes[mes.periodo] = v;
      total += v;
    }
    return { rotulo: col.rotulo, total, porMes };
  });

  return { meses, metricas: metricas.filter((m) => m.total > 0) };
}

// ------------------------------------------------ Banco de Soluções ----

/**
 * A aba do Banco de Soluções. O cliente chama de "Soluções"; a planilha ainda
 * exporta "BANCO DE SOLUÇÕES CRM" — o painel aceita as duas, para a aba poder
 * ser renomeada sem derrubar a página.
 */
const ABA_SOLUCOES = /^(solu[çc][õo]es|banco de solu[çc][õo]es.*)$/i;

/**
 * Texto de preenchimento do CRM. A equipe marca o que não foi coletado em vez
 * de deixar a célula vazia, e exibir "Não coletado" como se fosse um estado ou
 * uma área de atuação sujaria todos os agrupamentos da página.
 */
const SEM_INFORMACAO = /^(n[ãa]o coletad[oa]|n[ãa]o informad[oa]|ainda n[ãa]o possue|n\/a|-+)$/i;

const limpo = (valor: string | undefined): string => {
  const t = (valor ?? '').trim();
  return SEM_INFORMACAO.test(t) ? '' : t;
};

/**
 * Aba "Soluções": uma linha por solução submetida aos desafios da parceria.
 *
 * A aba não tem data — nem da inscrição, nem do edital. Os projetos de origem
 * têm ano nas abas operacionais, mas só dá para ligá-los por semelhança de
 * nome ("Hackaton Impulso Regional" × "Hackathon Impulso Regional: acelerando
 * territórios para a inovação"), e um palpite desses erra calado. Então o banco
 * é lido sem ano, e quem exibe o número declara que ele é o acumulado.
 */
function lerSolucoes(linhas: (nome: string | RegExp) => string[][]): BancoSolucoes {
  const rows = linhas(ABA_SOLUCOES);
  const reNome = /NOME DO PROJETO\s*\/\s*SOLU[ÇC][ÃA]O/i;
  const hIdx = rows.findIndex((r) => coluna(r, reNome) >= 0);
  if (hIdx < 0) return { solucoes: [], participantes: 0 };

  const h = rows[hIdx];
  const iNome = coluna(h, reNome);
  const iProjeto = coluna(h, /^PROJETO$/i);
  const iStatus = coluna(h, /^STATUS/i);
  const iResponsavel = coluna(h, /^RESPONS[ÁA]VEL$/i);
  const iEmail = coluna(h, /^E-?MAIL$/i);
  const iEstado = coluna(h, /^ESTADO/i);
  const iCidade = coluna(h, /^CIDADE/i);
  const iDesafio = coluna(h, /DESAFIO ESCOLHIDO/i);
  const iArea = coluna(h, /[ÁA]REA DE ATUA[ÇC][ÃA]O/i);

  // Uma equipe se inscreve em mais de um desafio: somar as pessoas linha a
  // linha contaria as mesmas de novo. O e-mail é a chave quando existe (a
  // planilha avisa que há duplicatas de nome), e o nome quando não existe.
  const pessoasDoBanco = new Set<string>();

  const solucoes: Solucao[] = [];
  for (const row of rows.slice(hIdx + 1)) {
    // Basta a célula do nome não estar vazia: uma inscrição marcada "N/A" ali
    // existe, e descartá-la faria o painel divergir em uma solução do total
    // que a própria aba declara no topo.
    if (!(row[iNome] ?? '').trim()) continue;
    const nome = limpo(row[iNome]) || 'Solução sem nome declarado';

    const emails = partes(row[iEmail]).filter((p) => p.includes('@'));
    const nomes = partes(row[iResponsavel]);
    const chaves = emails.length
      ? emails.map((e) => e.toLowerCase())
      : nomes.map((n) => `nome:${normalizar(n)}`);
    chaves.forEach((c) => pessoasDoBanco.add(c));

    solucoes.push({
      nome,
      projeto: limpo(row[iProjeto]) || 'Sem projeto declarado',
      status: limpo(row[iStatus]) || 'Sem status',
      uf: ufDoTexto(limpo(row[iEstado])),
      cidade: limpo(row[iCidade]),
      // Vírgula e ponto e vírgula separam áreas; a barra, não — "Social/
      // Socioeconômico" é um rótulo só na taxonomia da equipe.
      areas: limpo(row[iArea])
        .split(/[,;]/)
        .map((a) => a.trim())
        .filter(Boolean),
      desafio: limpo(row[iDesafio]),
      pessoas: new Set(chaves).size,
    });
  }

  return { solucoes, participantes: pessoasDoBanco.size };
}

/** Células com vários itens numa só: quebra de linha, ponto e vírgula ou vírgula. */
function partes(celula: string | undefined): string[] {
  return (celula ?? '')
    .split(/[\n;,]/)
    .map((p) => p.trim())
    .filter((p) => p && !SEM_INFORMACAO.test(p));
}

/** "São Paulo - SP", "SP", "são paulo" — qualquer das formas vira a sigla. */
function ufDoTexto(texto: string): string | null {
  for (const token of texto.split(/[-–,;/]/)) {
    const uf = tokenParaUf(token);
    if (uf) return uf;
  }
  return null;
}

// ------------------------------------------------- Eventos da Linha III ----

/**
 * Aba "LIII - Eventos, oficinas e SI + NPS": uma linha por evento, com
 * inscrições, participantes e NPS.
 *
 * Todos os eventos são lidos, inclusive os que cumprem outras metas da linha
 * (cocriação, conteúdo, Semana de Inovação) — quem decide o que entra em cada
 * contagem é a página, por `ehEventoDeConexao`. A aba termina com uma linha de
 * totais sem nome de evento, que o filtro do nome já descarta.
 */
function lerEventos(linhas: (nome: string | RegExp) => string[][]): EventoLinhaIII[] {
  const rows = linhas(/^LIII - Eventos/i);
  const hIdx = rows.findIndex((r) => coluna(r, /^Evento$/i) >= 0);
  if (hIdx < 0) return [];

  const h = rows[hIdx];
  const iNome = coluna(h, /^Evento$/i);
  const iData = coluna(h, /^Data$/i);
  const iAno = coluna(h, /^Ano$/i);
  const iClasse = coluna(h, /Classifica[çc][ãa]o/i);
  const iFormato = coluna(h, /^Formato$/i);
  const iInscricoes = coluna(h, /inscri[çc][õo]es/i);
  const iParticipantes = coluna(h, /participantes/i);
  const iTema = coluna(h, /^Tema$/i);
  const iNps = coluna(h, /^NPS$/i);

  const eventos: EventoLinhaIII[] = [];
  for (const row of rows.slice(hIdx + 1)) {
    const nome = (row[iNome] ?? '').trim();
    if (!nome) continue;

    const ano = Number((row[iAno] ?? '').trim()) || anoDasDatas(row[iData] ?? '');
    const nps = parseNumero(row[iNps]);
    eventos.push({
      nome,
      data: (row[iData] ?? '').trim(),
      ano: ano || null,
      classificacao: (row[iClasse] ?? '').trim(),
      formato: (row[iFormato] ?? '').trim(),
      tema: (row[iTema] ?? '').trim(),
      inscricoes: parseNumero(row[iInscricoes]),
      participantes: parseNumero(row[iParticipantes]),
      nps: nps > 0 ? nps : null,
    });
  }
  return eventos;
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
