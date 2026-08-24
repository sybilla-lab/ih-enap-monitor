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
  /** Soluções enviadas aos desafios (coluna "SOLUÇÕES ENVIADAS" da Linha I). */
  solucoes: ContagemPorAno;
  /** Participantes inscritos nos desafios da Linha I. */
  participantesDesafios: ContagemPorAno;
  /** Premiação paga aos desafios, da aba LIV - Premiação (total geral por ano). */
  premiacao: ContagemPorAno;
}
