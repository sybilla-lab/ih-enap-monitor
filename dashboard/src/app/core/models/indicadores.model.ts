export type LinhaAcaoId = 'Linha I' | 'Linha II' | 'Linha III' | 'Linha IV';

export interface LinhaAcao {
  id: LinhaAcaoId;
  nome: string;
}

export const LINHAS_ACAO: LinhaAcao[] = [
  { id: 'Linha I', nome: 'Inovação Aberta e Desafios' },
  { id: 'Linha II', nome: 'Aceleração' },
  { id: 'Linha III', nome: 'Conhecimento e Comunidades' },
  { id: 'Linha IV', nome: 'Sustentabilidade e Captação' },
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
