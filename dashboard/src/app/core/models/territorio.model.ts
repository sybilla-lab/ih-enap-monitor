import { LinhaAcaoId } from './indicadores.model';

export interface Municipio {
  cidade: string;
  uf: string;
}

export interface OrgRanking {
  nome: string;
  agentes: number;
  /** UF quando a organização é municipal (prefeitura); null para federais. */
  uf: string | null;
}

/**
 * Registros territoriais normalizados em build-time (scripts/extrair_territorio.mjs).
 * Cada um carrega linha de ação e ano — é o que permite o filtro global recortar
 * esta página. `ano: null` = a fonte não informa a data (ciclos de aceleração de
 * 2024 registram só dd/mm); esses registros ficam fora de um recorte por ano.
 */
export interface RegistroAlcance {
  uf: string;
  iniciativa: string;
  linha: LinhaAcaoId;
  ano: number | null;
}

/** Um agente público engajado. Sem nome: as abas de origem têm PII. */
export interface RegistroAgente {
  instituicao: string;
  projeto: string;
  uf: string | null;
  cidade: string | null;
  linha: LinhaAcaoId;
  ano: number | null;
}

export interface RegistroOrganizacao {
  nome: string;
  nivel: string;
  /** Atividades em que a organização se engajou, como a planilha registra. */
  engajamento: string;
  linha: LinhaAcaoId;
  ano: number | null;
}

export interface TerritorioBruto {
  atualizadoEm: string;
  totalUfs: number;
  alcance: RegistroAlcance[];
  agentes: RegistroAgente[];
  organizacoes: RegistroOrganizacao[];
}

/** Agregado do recorte em vigor — recalculado a cada mudança de filtro. */
export interface Territorio {
  atualizadoEm: string;
  totalUfs: number;
  ufsAlcancadas: number;
  /** UF → nº de iniciativas distintas que alcançaram o estado. */
  alcancePorUf: Record<string, number>;
  municipios: Municipio[];
  organizacoesPublicas: number;
  organizacoesPorNivel: Record<string, number>;
  rankingOrgsPorAgentes: OrgRanking[];
  totalAgentes: number;
  /** Registros deixados de fora por não terem data — só num recorte por ano. */
  semData: number;
  vazio: boolean;
  /** Os registros do recorte, para o painel de detalhe abrir o que há por trás. */
  registros: {
    alcance: RegistroAlcance[];
    agentes: RegistroAgente[];
    organizacoes: RegistroOrganizacao[];
  };
}

export interface UfInfo {
  sigla: string;
  nome: string;
  /** Posição no cartograma de tiles (linha, coluna). */
  linha: number;
  coluna: number;
}

/**
 * Cartograma de tiles do Brasil: cada UF é um quadrado numa grade 9×7,
 * posicionado de forma a aproximar a geografia (Norte no topo, Nordeste à
 * direita, Sul embaixo). Escolha deliberada em vez de um mapa geográfico —
 * os dados são de presença por estado, não de intensidade precisa por área.
 */
export const UF_GRID: UfInfo[] = [
  { sigla: 'RR', nome: 'Roraima', linha: 0, coluna: 2 },
  { sigla: 'AP', nome: 'Amapá', linha: 0, coluna: 3 },
  { sigla: 'AM', nome: 'Amazonas', linha: 1, coluna: 1 },
  { sigla: 'PA', nome: 'Pará', linha: 1, coluna: 2 },
  { sigla: 'MA', nome: 'Maranhão', linha: 1, coluna: 3 },
  { sigla: 'CE', nome: 'Ceará', linha: 1, coluna: 4 },
  { sigla: 'RN', nome: 'Rio Grande do Norte', linha: 1, coluna: 5 },
  { sigla: 'AC', nome: 'Acre', linha: 2, coluna: 0 },
  { sigla: 'RO', nome: 'Rondônia', linha: 2, coluna: 1 },
  { sigla: 'TO', nome: 'Tocantins', linha: 2, coluna: 2 },
  { sigla: 'PI', nome: 'Piauí', linha: 2, coluna: 3 },
  { sigla: 'PB', nome: 'Paraíba', linha: 2, coluna: 5 },
  { sigla: 'MT', nome: 'Mato Grosso', linha: 3, coluna: 2 },
  { sigla: 'BA', nome: 'Bahia', linha: 3, coluna: 4 },
  { sigla: 'PE', nome: 'Pernambuco', linha: 3, coluna: 5 },
  { sigla: 'AL', nome: 'Alagoas', linha: 3, coluna: 6 },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', linha: 4, coluna: 2 },
  { sigla: 'GO', nome: 'Goiás', linha: 4, coluna: 3 },
  { sigla: 'DF', nome: 'Distrito Federal', linha: 4, coluna: 4 },
  { sigla: 'SE', nome: 'Sergipe', linha: 4, coluna: 6 },
  { sigla: 'MG', nome: 'Minas Gerais', linha: 5, coluna: 4 },
  { sigla: 'ES', nome: 'Espírito Santo', linha: 5, coluna: 5 },
  { sigla: 'SP', nome: 'São Paulo', linha: 6, coluna: 3 },
  { sigla: 'RJ', nome: 'Rio de Janeiro', linha: 6, coluna: 4 },
  { sigla: 'PR', nome: 'Paraná', linha: 7, coluna: 3 },
  { sigla: 'SC', nome: 'Santa Catarina', linha: 7, coluna: 4 },
  { sigla: 'RS', nome: 'Rio Grande do Sul', linha: 8, coluna: 3 },
];
