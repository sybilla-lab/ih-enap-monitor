import { PontoAvanco } from '../../core/util/agregacao.util';

/**
 * Geometria dos gráficos do relatório.
 *
 * O relatório não usa canvas: cada gráfico é SVG montado a partir destes
 * cálculos. Num PDF impresso pelo navegador, canvas vira imagem serrilhada —
 * SVG sai vetorial, imprime nítido em qualquer escala e mantém o texto
 * selecionável. É também o que permite ao documento herdar as mesmas cores e
 * tipografia da aplicação, em vez de virar uma captura de tela.
 */

export interface Caixa {
  largura: number;
  altura: number;
  margemEsq: number;
  margemDir: number;
  margemTopo: number;
  margemBase: number;
}

const CAIXA_LINHA: Caixa = {
  largura: 640,
  altura: 200,
  margemEsq: 38,
  margemDir: 12,
  margemTopo: 12,
  margemBase: 28,
};

export interface GraficoAvanco {
  caixa: Caixa;
  /** Linhas horizontais de 0 a 100%, com o rótulo já posicionado. */
  grade: { y: number; rotulo: string }[];
  anos: { x: number; rotulo: string }[];
  linhaPlano: string;
  linhaRealizado: string;
  linhaParcial: string;
  areaRealizado: string;
  marcas: { x: number; y: number; parcial: boolean }[];
}

/** Burn-up do relatório: entregue da meta 2028 contra o cronograma. */
export function graficoAvanco(pontos: PontoAvanco[]): GraficoAvanco | null {
  if (pontos.length < 2) return null;
  const c = CAIXA_LINHA;
  const larguraUtil = c.largura - c.margemEsq - c.margemDir;
  const alturaUtil = c.altura - c.margemTopo - c.margemBase;

  const x = (i: number) => c.margemEsq + (i / (pontos.length - 1)) * larguraUtil;
  const y = (v: number) => c.margemTopo + (1 - v / 100) * alturaUtil;

  const comDados = pontos.filter((p) => p.realizado !== null);
  const indiceParcial = pontos.findIndex((p) => p.parcial);
  // O trecho pontilhado começa no ponto anterior ao ano em curso.
  const inicioParcial = indiceParcial > 0 ? indiceParcial - 1 : -1;

  const traco = (lista: { i: number; v: number }[]) =>
    lista.map((p, k) => `${k === 0 ? 'M' : 'L'} ${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');

  const plano = pontos.map((p, i) => ({ i, v: p.plano }));
  const realizado = comDados.map((p) => ({ i: pontos.indexOf(p), v: p.realizado ?? 0 }));
  const cheio = inicioParcial >= 0 ? realizado.filter((p) => p.i <= inicioParcial) : realizado;
  const parcial = inicioParcial >= 0 ? realizado.filter((p) => p.i >= inicioParcial) : [];

  const base = y(0).toFixed(1);
  const area = realizado.length
    ? `${traco(realizado)} L ${x(realizado[realizado.length - 1].i).toFixed(1)} ${base} L ${x(realizado[0].i).toFixed(1)} ${base} Z`
    : '';

  return {
    caixa: c,
    grade: [0, 25, 50, 75, 100].map((v) => ({ y: y(v), rotulo: `${v}%` })),
    anos: pontos.map((p, i) => ({ x: x(i), rotulo: String(p.ano) })),
    linhaPlano: traco(plano),
    linhaRealizado: traco(cheio),
    linhaParcial: parcial.length > 1 ? traco(parcial) : '',
    areaRealizado: area,
    marcas: realizado.map((p) => ({ x: x(p.i), y: y(p.v), parcial: pontos[p.i].parcial })),
  };
}

export interface BarraHorizontal {
  rotulo: string;
  detalhe: string;
  valor: string;
  /** 0–100, largura da barra preenchida. */
  preenchimento: number;
  /** 0–100, largura da barra de referência (meta), quando houver. */
  referencia?: number;
}

/** Escala comum a um conjunto de barras: o maior valor vale 100%. */
export function escalaComum(valores: number[]): (v: number) => number {
  const maior = Math.max(...valores, 0);
  return (v: number) => (maior > 0 ? (v / maior) * 100 : 0);
}

export interface TileMapa {
  sigla: string;
  x: number;
  y: number;
  intensidade: number; // 0–1, define o preenchimento
  alcance: number;
}

/** Cartograma do relatório na mesma grade 7×9 usada na tela. */
export function tilesDoMapa(
  grade: { sigla: string; linha: number; coluna: number }[],
  alcancePorUf: Record<string, number>,
): { tiles: TileMapa[]; lado: number; largura: number; altura: number } {
  const lado = 30;
  const espaco = 4;
  const maior = Math.max(...Object.values(alcancePorUf), 1);
  return {
    lado,
    largura: 7 * (lado + espaco),
    altura: 9 * (lado + espaco),
    tiles: grade.map((uf) => {
      const alcance = alcancePorUf[uf.sigla] ?? 0;
      return {
        sigla: uf.sigla,
        x: uf.coluna * (lado + espaco),
        y: uf.linha * (lado + espaco),
        intensidade: alcance > 0 ? 0.25 + (alcance / maior) * 0.75 : 0,
        alcance,
      };
    }),
  };
}
