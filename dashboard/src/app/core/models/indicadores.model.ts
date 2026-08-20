export type LinhaAcaoId = 'Linha I' | 'Linha II' | 'Linha III' | 'Linha IV';

export interface LinhaAcao {
  id: LinhaAcaoId;
  nome: string;
}

// Nomes conforme a nomenclatura oficial do cliente. Os ids continuam sendo o
// texto que a planilha usa na coluna "Linha de Ação" — mudar isso quebraria o
// vínculo com a fonte.
export const LINHAS_ACAO: LinhaAcao[] = [
  { id: 'Linha I', nome: 'Projetos de inovação aberta' },
  { id: 'Linha II', nome: 'Aceleração e Incubação' },
  { id: 'Linha III', nome: 'Cultura, conhecimento e comunidades' },
  { id: 'Linha IV', nome: 'Prospecção e Retorno da Parceria' },
];

export const ANOS_PARCERIA = [2024, 2025, 2026, 2027, 2028] as const;

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
