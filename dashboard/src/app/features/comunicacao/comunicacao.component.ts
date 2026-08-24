import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '../../core/services/data.service';
import { GlobalFilterService } from '../../core/services/global-filter.service';
import { formatQuantidade } from '../../core/util/numero.util';

const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

interface SerieMensal {
  rotulo: string;
  total: string;
  media: string;
  pontos: { periodo: string; rotuloCurto: string; valor: number; rotulo: string; altura: number }[];
}

/**
 * Comunicação: o alcance da parceria fora dos indicadores pactuados.
 *
 * A aba de origem hoje tem só 2026 e é mensal — a equipe de comunicação está
 * estruturando o acompanhamento. Por isso a página não fixa quais métricas
 * existem: lê as colunas que estiverem lá e monta uma série por coluna. Quando
 * a planilha ganhar novas métricas ou anos, eles aparecem aqui sozinhos.
 */
@Component({
  selector: 'app-comunicacao',
  standalone: true,
  imports: [MatIconModule, MatProgressBarModule],
  templateUrl: './comunicacao.component.html',
  styleUrl: './comunicacao.component.scss',
})
export class ComunicacaoComponent {
  readonly dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);

  private comunicacao = computed(() => this.dados.comunicacao());

  /** Meses dentro do recorte de anos escolhido no filtro. */
  private mesesDoRecorte = computed(() => {
    const recorte = this.filtro.recorte();
    const meses = this.comunicacao()?.meses ?? [];
    return recorte === null ? meses : meses.filter((m) => recorte.includes(m.ano));
  });

  readonly anosDisponiveis = computed(() => [
    ...new Set((this.comunicacao()?.meses ?? []).map((m) => m.ano)),
  ]);

  readonly vazio = computed(() => this.mesesDoRecorte().length === 0);

  readonly periodo = computed(() => {
    const meses = this.mesesDoRecorte();
    if (!meses.length) return '';
    const primeiro = meses[0];
    const ultimo = meses[meses.length - 1];
    const nome = (m: { mes: number; ano: number }) => `${MESES[m.mes - 1]}/${m.ano}`;
    return primeiro === ultimo ? nome(primeiro) : `${nome(primeiro)} a ${nome(ultimo)}`;
  });

  /** Uma série por métrica da planilha, já na escala do próprio gráfico. */
  readonly series = computed<SerieMensal[]>(() => {
    const meses = this.mesesDoRecorte();
    const metricas = this.comunicacao()?.metricas ?? [];
    if (!meses.length) return [];

    return metricas
      .map((metrica) => {
        const valores = meses.map((m) => m.valores[metrica.rotulo] ?? 0);
        const total = valores.reduce((s, v) => s + v, 0);
        const maior = Math.max(...valores, 1);
        const comValor = valores.filter((v) => v > 0).length;
        return {
          rotulo: metrica.rotulo,
          total: formatQuantidade(total),
          media: comValor ? formatQuantidade(Math.round(total / comValor)) : '—',
          pontos: meses.map((m, i) => ({
            periodo: m.periodo,
            rotuloCurto: MESES[m.mes - 1],
            valor: valores[i],
            rotulo: valores[i] ? formatQuantidade(valores[i]) : '—',
            altura: (valores[i] / maior) * 100,
          })),
          total_: total,
        };
      })
      .filter((s) => s.total_ > 0)
      .map(({ total_, ...s }) => s);
  });

  /** As quatro métricas de maior volume viram os números do topo. */
  readonly destaques = computed(() => {
    const meses = this.mesesDoRecorte();
    const metricas = this.comunicacao()?.metricas ?? [];
    return metricas
      .map((metrica) => ({
        rotulo: metrica.rotulo,
        valor: meses.reduce((s, m) => s + (m.valores[metrica.rotulo] ?? 0), 0),
      }))
      .filter((m) => m.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 4)
      .map((m) => ({ rotulo: m.rotulo, valor: formatQuantidade(m.valor) }));
  });

  // ------------------------------------------------ leitura em detalhe ----

  /** Métrica escolhida no seletor; null = a de maior volume no período. */
  private escolhida = signal<string | null>(null);

  readonly metricaAtiva = computed(
    () => this.escolhida() ?? this.destaques()[0]?.rotulo ?? this.series()[0]?.rotulo ?? null,
  );

  escolher(rotulo: string): void {
    this.escolhida.set(rotulo);
  }

  /**
   * A mesma série do painel acima, agora sozinha e em escala cheia.
   *
   * A visão de todas as métricas responde "como cada frente se comportou"; esta
   * responde "o que aconteceu com esta métrica" — com o melhor mês, a média e a
   * variação do último mês, que a grade de sparklines não tem espaço para dizer.
   */
  readonly detalhe = computed(() => {
    const ativa = this.metricaAtiva();
    const serie = this.series().find((s) => s.rotulo === ativa);
    if (!serie || !serie.pontos.length) return null;

    const valores = serie.pontos.map((p) => p.valor);
    const maior = Math.max(...valores, 1);
    const total = valores.reduce((s, v) => s + v, 0);
    const comValor = valores.filter((v) => v > 0);
    const melhorIdx = valores.indexOf(Math.max(...valores));

    // Geometria do gráfico: um sistema pequeno, próprio, para o SVG do template.
    const largura = 900;
    const altura = 240;
    const margem = { esq: 8, dir: 8, topo: 34, base: 30 };
    const util = { l: largura - margem.esq - margem.dir, a: altura - margem.topo - margem.base };
    const x = (i: number) =>
      margem.esq + (serie.pontos.length === 1 ? util.l / 2 : (i / (serie.pontos.length - 1)) * util.l);
    const y = (v: number) => margem.topo + (1 - v / maior) * util.a;

    const pontos = serie.pontos.map((p, i) => ({
      ...p,
      x: x(i),
      y: y(p.valor),
      melhor: i === melhorIdx && p.valor > 0,
    }));
    const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const base = (altura - margem.base).toFixed(1);

    const ultimo = valores[valores.length - 1];
    const penultimo = valores[valores.length - 2];
    const mesFinal = serie.pontos[serie.pontos.length - 1].rotuloCurto;
    const variacao =
      penultimo > 0 && ultimo > 0 ? Math.round(((ultimo - penultimo) / penultimo) * 100) : null;

    // Sem variação a razão importa: mês zerado e mês sem base de comparação
    // são coisas diferentes, e "—" não distingue as duas.
    const semVariacao =
      ultimo === 0
        ? `sem registro em ${mesFinal}`
        : penultimo === 0
          ? `${formatQuantidade(ultimo)} em ${mesFinal}, sem base no mês anterior`
          : 'sem mês anterior para comparar';

    return {
      rotulo: serie.rotulo,
      largura,
      altura,
      linha,
      area: `${linha} L ${pontos[pontos.length - 1].x.toFixed(1)} ${base} L ${pontos[0].x.toFixed(1)} ${base} Z`,
      pontos,
      base: Number(base),
      grade: [0, 0.5, 1].map((f) => ({ y: y(maior * f), rotulo: formatQuantidade(Math.round(maior * f)) })),
      total: formatQuantidade(total),
      media: comValor.length ? formatQuantidade(Math.round(total / comValor.length)) : '—',
      melhorValor: formatQuantidade(valores[melhorIdx]),
      melhorMes: serie.pontos[melhorIdx].rotuloCurto,
      variacao,
      variacaoTexto:
        variacao === null
          ? semVariacao
          : `${variacao >= 0 ? '+' : ''}${variacao}% em relação ao mês anterior`,
    };
  });

  /** Tabela completa: um mês por linha, uma métrica por coluna. */
  readonly tabela = computed(() => {
    const meses = this.mesesDoRecorte();
    const colunas = this.series().map((s) => s.rotulo);
    return {
      colunas,
      linhas: meses.map((m) => ({
        periodo: m.periodo,
        valores: colunas.map((c) => {
          const v = m.valores[c] ?? 0;
          return v ? formatQuantidade(v) : '—';
        }),
      })),
      totais: colunas.map((c) =>
        formatQuantidade(meses.reduce((s, m) => s + (m.valores[c] ?? 0), 0)),
      ),
    };
  });
}
