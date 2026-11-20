export type LinhaAcaoId = 'Linha I' | 'Linha II' | 'Linha III' | 'Linha IV';

export interface LinhaAcao {
  id: LinhaAcaoId;
  /** Nome oficial completo, como no Termo de Colaboração. */
  nome: string;
  /** Forma curta para menu, gráficos e tabelas, onde o nome inteiro não cabe. */
  curto: string;
  descricao: string;
}

// Nomes e textos conforme a nomenclatura oficial do cliente (revisão 02). Os
// ids continuam sendo o texto que a planilha usa na coluna "Linha de Ação" —
// mudar isso quebraria o vínculo com a fonte.
export const LINHAS_ACAO: LinhaAcao[] = [
  {
    id: 'Linha I',
    nome: 'Gestão e execução de projetos de inovação aberta para a solução de problemas públicos',
    curto: 'Projetos de inovação aberta',
    descricao:
      'A parceria viabiliza a concepção, execução e monitoramento de projetos e competições de inovação aberta e compras públicas de inovação, tanto na modalidade customizada quanto no autosserviço da Plataforma Desafios.',
  },
  {
    id: 'Linha II',
    nome: 'Aceleração e Incubação de Soluções inovadoras para Problemas Públicos',
    curto: 'Aceleração e Incubação',
    descricao:
      'A parceria foca no fortalecimento do empreendedorismo inovador orientado a problemas públicos, com a aceleração de soluções e negócios, com base em desafios públicos mapeados.',
  },
  {
    id: 'Linha III',
    nome: 'Promoção de cultura, conhecimento e fortalecimento de comunidades de inovação aberta',
    curto: 'Cultura, conhecimento e comunidades',
    descricao:
      'A Linha III é central para a sustentabilidade e o posicionamento estratégico da parceria, com foco em cultura, engajamento e produção de conhecimento.',
  },
  {
    id: 'Linha IV',
    nome: 'Prospecção de projetos de inovação aberta para mapeamento de oportunidades e desafios no setor público',
    curto: 'Prospecção e Retorno da Parceria',
    descricao:
      'A Linha IV estrutura a sustentabilidade financeira e estratégica da parceria. Essa linha é fundamental para reduzir as limitações orçamentárias, ampliar a escala, garantir continuidade das ações e o alcance das metas.',
  },
];

export const ANOS_PARCERIA = [2024, 2025, 2026, 2027, 2028] as const;

/**
 * Indicadores pactuados no Plano Complementar, e não no plano original.
 *
 * A planilha não tem coluna para isso — a distinção veio do cliente, por nome
 * do indicador. Se a fonte passar a marcar, é este ponto que muda.
 */
const PLANO_COMPLEMENTAR = [
  /Realiza[çc][ãa]o de oficinas conforme metodologias/i,
  /Participa[çc][ãa]o na Semana de Inova[çc][ãa]o/i,
];

export function ehPlanoComplementar(nomeDoIndicador: string): boolean {
  return PLANO_COMPLEMENTAR.some((padrao) => padrao.test(nomeDoIndicador));
}

/**
 * Anos que valem a pena exibir numa série: os que já começaram, mais qualquer
 * ano que o filtro tenha selecionado explicitamente.
 *
 * Ano futuro só tem meta e realizado zerado — a coluna vazia ocupa espaço e não
 * informa nada (pedido do cliente na revisão 02). A meta final continua visível
 * no acumulado de cada indicador ("de 54 até 2028").
 */
export function anosVisiveis(recorte: number[] | null = null): number[] {
  const limite = Math.max(new Date().getFullYear(), ...(recorte ?? []));
  return ANOS_PARCERIA.filter((ano) => ano <= limite);
}

/**
 * Unidade do indicador — determina formatação e como o valor entra em
 * agregações. Percentuais e NPS não são somáveis entre indicadores; toda
 * agregação da aplicação normaliza para % de cumprimento da própria meta.
 */
export type UnidadeIndicador = 'quantidade' | 'percentual' | 'moeda' | 'nps';

export interface MetaAnual {
  ano: number;
  meta: number;
  realizado: number;
}

export interface Indicador {
  linha: LinhaAcaoId;
  nome: string;
  unidade: UnidadeIndicador;
  anos: MetaAnual[];
  metaTotal: number;
  realizadoTotal: number; // YTD na planilha
}

export interface AportePorAno {
  ano: number;
  valor: number;
}

export interface EscalaDesafios {
  meta: number; // meta global contratada até 2028
  projecao: number; // alcance projetado no mesmo período
  nota: string;
}

export interface ParceriaResumo {
  investimentoInicial: number;
  valorCaptado: number;
  retornoLiquido: number;
  roiPercentual: number; // ex.: 769
  alavancagem: number; // R$ captados por R$ 1 investido
  aportes: AportePorAno[];
  escalaDesafios: EscalaDesafios | null;
}

/**
 * Números de entrega que não estão na aba Metas — vêm das abas operacionais
 * (atividades, premiação) e alimentam os KPIs da Home. Cada um guarda o total e
 * a quebra por ano, para responder ao filtro.
 */
export interface ContagemPorAno {
  total: number;
  porAno: Record<number, number>;
  /** Registros sem data na origem: entram no total, não no recorte por ano. */
  semData: number;
}

/**
 * Comunicação: a aba traz uma linha por mês e uma coluna por métrica. As
 * colunas não são fixas de propósito — a equipe de comunicação está montando o
 * acompanhamento e vai acrescentar métricas e anos. O painel lê o que estiver
 * lá, em vez de exigir um conjunto de colunas conhecido.
 */
export interface MesComunicacao {
  periodo: string; // "01/2026"
  ano: number;
  mes: number;
  valores: Record<string, number>;
}

export interface MetricaComunicacao {
  rotulo: string;
  total: number;
  porMes: Record<string, number>;
}

export interface Comunicacao {
  meses: MesComunicacao[];
  metricas: MetricaComunicacao[];
}

export interface EntregasOperacionais {
  /** Projetos distintos registrados nas abas de atividades das linhas I, II e III. */
  projetos: ContagemPorAno;
  /** Premiação paga aos desafios, da aba LIV - Premiação (total geral por ano). */
  premiacao: ContagemPorAno;
}

/**
 * Uma solução do Banco de Soluções (aba "Soluções").
 *
 * É o cadastro do que o ecossistema submeteu aos desafios da parceria: uma
 * linha por solução, com a origem (o edital/projeto em que ela entrou), o
 * estágio em que parou e de onde vem a equipe. Nomes, e-mails e telefones estão
 * na planilha e não são lidos — o painel conta pessoas, não as identifica.
 */
export interface Solucao {
  nome: string;
  /** Projeto/edital de origem — é o que a aba chama de "fonte". */
  projeto: string;
  /** "Inscrito", "Selecionado", "Premiado" — estágio em que a solução parou. */
  status: string;
  uf: string | null;
  cidade: string;
  /** Áreas de atuação declaradas pela equipe (a célula traz várias). */
  areas: string[];
  desafio: string;
  /** Pessoas distintas na equipe responsável pela solução. */
  pessoas: number;
}

/**
 * O Banco de Soluções inteiro.
 *
 * Não tem data: a aba não traz coluna de período e as soluções herdariam o ano
 * do edital por semelhança de nome — inferência que daria número errado sem
 * avisar. Por isso os dois KPIs que saem daqui são acumulados do banco e não
 * respondem ao recorte por ano, o que o próprio card declara.
 */
export interface BancoSolucoes {
  solucoes: Solucao[];
  /**
   * Pessoas distintas no banco: a mesma equipe aparece em mais de uma inscrição
   * e seria contada duas vezes somando linha a linha. A chave é o e-mail
   * quando existe, e o nome quando não.
   */
  participantes: number;
}

/**
 * Um evento, oficina ou participação em Semana de Inovação da Linha III
 * (aba "LIII - Eventos, oficinas e SI + NPS").
 */
export interface EventoLinhaIII {
  nome: string;
  data: string;
  ano: number | null;
  /** Qual meta da Linha III o evento cumpre — é o que define o que entra na conta. */
  classificacao: string;
  formato: string;
  tema: string;
  inscricoes: number;
  participantes: number;
  /** NPS apurado no evento; null quando não houve coleta. */
  nps: number | null;
}

/**
 * Classificações que contam como "evento realizado" na Linha III, conforme a
 * revisão 04: as atividades de conexão/networking e as oficinas do Plano
 * Adicional. Cocriação, conteúdo produzido e Semana de Inovação são metas
 * próprias da linha e ficam fora desta contagem.
 */
export function ehEventoDeConexao(classificacao: string): boolean {
  return (
    /atividades que promovam conex/i.test(classificacao) ||
    /oficinas.*plano adicional/i.test(classificacao)
  );
}
