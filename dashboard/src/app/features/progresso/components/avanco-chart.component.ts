import { Component, computed, inject } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

// Registro local (em vez de provideCharts no app.config) para o chart.js
// permanecer no chunk lazy da Home, fora do bundle inicial.
Chart.register(...registerables);
import { DataService } from '../../../core/services/data.service';
import { GlobalFilterService } from '../../../core/services/global-filter.service';
import { ThemeService } from '../../../core/services/theme.service';
import { avancoRumoAMetaFinal, ehCumulativo } from '../../../core/util/agregacao.util';
import { comAlpha, corDoToken } from '../../../core/util/cores.util';
import { formatPercentual } from '../../../core/util/numero.util';

/**
 * Avanço rumo a 2028 (burn-up): quanto da meta final já foi entregue, ano a ano,
 * contra o que o cronograma previa entregar até cada ano.
 *
 * Substitui a leitura anterior ("cumprimento acumulado × 100%"), que era uma
 * taxa — realizado ÷ meta do período — e por isso caía quando o ano corrente
 * entrava na conta com a meta cheia e o realizado só até hoje. Aqui o
 * denominador é fixo (a meta de 2028), então a curva do realizado só pode
 * crescer, e o atraso aparece como distância até a linha do plano, que é o que
 * a leitura precisa mostrar.
 */
@Component({
  selector: 'app-avanco-chart',
  standalone: true,
  imports: [BaseChartDirective],
  template: `
    <!-- Legenda em HTML, não a do chart.js: só assim a amostra reproduz o traço
         exato de cada linha (cheia, tracejada, pontilhada) — e o trecho parcial,
         que não é uma série, também ganha explicação. -->
    <ul class="legenda">
      <li class="legenda__item legenda__item--dado">
        <svg width="24" height="8" aria-hidden="true">
          <line x1="1" y1="4" x2="23" y2="4" stroke="currentColor" stroke-width="2" />
        </svg>
        Entregue da meta 2028
      </li>
      <li class="legenda__item legenda__item--plano">
        <svg width="24" height="8" aria-hidden="true">
          <line x1="1" y1="4" x2="23" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="5 5" />
        </svg>
        Plano (metas acumuladas)
      </li>
      @if (anoParcial(); as ano) {
        <li class="legenda__item legenda__item--dado">
          <svg width="24" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="23" y2="4" stroke="currentColor" stroke-width="2" stroke-dasharray="2 3" />
          </svg>
          {{ ano }} parcial
        </li>
      }
    </ul>

    <div class="grafico">
      <canvas
        baseChart
        type="line"
        [data]="chartData()"
        [options]="chartOptions()"
        aria-label="Avanço acumulado rumo à meta de 2028, comparado ao cronograma previsto"
        role="img"
      ></canvas>
    </div>

    @if (posicao(); as p) {
      <p class="leitura">
        Até {{ p.ano }}, <strong>{{ formatar(p.realizado) }}</strong> da meta de 2028 entregue.
        @if (p.parcial) {
          O cronograma prevê {{ formatar(p.plano) }} até o fim do ano.
        } @else {
          O cronograma previa {{ formatar(p.plano) }} — {{ p.diferenca >= 0 ? 'à frente' : 'atrás' }}.
        }
      </p>
    }

    <p class="nota">
      Média de {{ totalCumulativos() }} indicadores cumulativos (contagens e R$), cada um
      normalizado pela própria meta total. NPS e percentuais de execução ficam fora: são
      medidas do período, não se acumulam.
      @if (anoParcial(); as ano) {
        O ponto de {{ ano }} é parcial — o plano já conta o ano inteiro, o realizado vai só
        até hoje.
      }
    </p>

    <details class="tabela">
      <summary>Ver dados em tabela</summary>
      <table>
        <thead>
          <tr>
            <th scope="col">Ano</th>
            <th scope="col">Entregue da meta 2028</th>
            <th scope="col">Plano</th>
          </tr>
        </thead>
        <tbody>
          @for (ponto of pontos(); track ponto.ano) {
            <tr>
              <td>{{ ponto.ano }} @if (ponto.parcial) { <span class="tag">parcial</span> }</td>
              <td>{{ ponto.realizado === null ? '—' : formatar(ponto.realizado) }}</td>
              <td>{{ formatar(ponto.plano) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </details>
  `,
  styles: `
    .legenda {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 18px;
      margin: 0 0 10px;
      padding: 0;
      list-style: none;

      &__item {
        display: flex;
        align-items: center;
        gap: 7px;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);

        // A cor vive no item; o traço herda por currentColor.
        &--dado svg {
          color: var(--app-viz-accent);
        }

        &--plano svg {
          color: var(--app-viz-neutral);
        }
      }
    }

    .grafico {
      position: relative;
      height: 260px;
    }

    .leitura {
      margin: 12px 0 0;
      font: var(--mat-sys-body-medium);

      strong {
        font-variant-numeric: tabular-nums;
      }
    }

    .nota {
      margin: 6px 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .tag {
      display: inline-block;
      padding: 1px 6px;
      margin-left: 4px;
      border-radius: 999px;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
      font-size: 11px;
      vertical-align: middle;
    }

    .tabela {
      margin-top: 10px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);

      summary {
        cursor: pointer;
      }

      table {
        margin-top: 8px;
        border-collapse: collapse;
        font-variant-numeric: tabular-nums;
      }

      th,
      td {
        padding: 4px 16px 4px 0;
        text-align: left;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
    }
  `,
})
export class AvancoChartComponent {
  private dados = inject(DataService);
  private filtro = inject(GlobalFilterService);
  private theme = inject(ThemeService);

  constructor() {
    Chart.defaults.font.family = "Roboto, 'Helvetica Neue', sans-serif";
  }

  readonly formatar = formatPercentual;

  readonly pontos = computed(() => avancoRumoAMetaFinal(this.dados.indicadores()));

  readonly totalCumulativos = computed(
    () => this.dados.indicadores().filter(ehCumulativo).length,
  );

  readonly anoParcial = computed(() => this.pontos().find((p) => p.parcial)?.ano ?? null);

  /** Último ponto com realizado — a frase de leitura acima da nota. */
  readonly posicao = computed(() => {
    const comDados = this.pontos().filter((p) => p.realizado !== null);
    const ultimo = comDados[comDados.length - 1];
    if (!ultimo || ultimo.realizado === null) return null;
    return {
      ano: ultimo.ano,
      realizado: ultimo.realizado,
      plano: ultimo.plano,
      parcial: ultimo.parcial,
      diferenca: ultimo.realizado - ultimo.plano,
    };
  });

  readonly chartData = computed<ChartConfiguration<'line'>['data']>(() => {
    this.theme.mode(); // recalcula as cores quando o tema muda
    const pts = this.pontos();
    const anoSelecionado = this.filtro.ano();
    const accent = corDoToken('--app-viz-accent');
    const contexto = corDoToken('--app-viz-neutral');
    const surface = corDoToken('--mat-sys-surface');

    return {
      labels: pts.map((p) => String(p.ano)),
      datasets: [
        {
          label: 'Plano (metas acumuladas)',
          data: pts.map((p) => Math.round(p.plano)),
          borderColor: contexto,
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.25,
        },
        {
          label: 'Entregue da meta 2028',
          data: pts.map((p) => (p.realizado === null ? null : Math.round(p.realizado))),
          borderColor: accent,
          backgroundColor: comAlpha(accent, 0.1),
          fill: true,
          tension: 0.25,
          borderWidth: 2,
          spanGaps: false,
          // Segmento que leva ao ano em curso fica pontilhado — sinaliza "ainda
          // incompleto" antes mesmo de o leitor reparar no rótulo. Ponto miúdo,
          // não tracejado, para não se confundir com a linha do plano.
          segment: {
            borderDash: (ctx) => (pts[ctx.p1DataIndex]?.parcial ? [2, 3] : undefined),
          },
          pointRadius: pts.map((p) => (p.realizado === null ? 0 : p.ano === anoSelecionado ? 7 : 5)),
          pointBackgroundColor: pts.map((p) => (p.parcial ? surface : accent)),
          pointBorderColor: pts.map((p) => (p.parcial ? accent : surface)),
          pointBorderWidth: 2,
        },
      ],
    };
  });

  readonly chartOptions = computed<ChartConfiguration<'line'>['options']>(() => {
    this.theme.mode();
    const ink = corDoToken('--mat-sys-on-surface');
    const inkSecundaria = corDoToken('--mat-sys-on-surface-variant');
    const grade = comAlpha(corDoToken('--mat-sys-outline-variant'), 0.6);
    // Tooltip na própria superfície do tema (não em inverse-surface, que no dark
    // dava texto escuro sobre fundo escuro), com fio de contorno para separar.
    const tooltipFundo = corDoToken('--mat-sys-surface-container-highest');
    const tooltipBorda = corDoToken('--mat-sys-outline-variant');
    const pts = this.pontos();

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, // a legenda é HTML, acima do canvas
        tooltip: {
          backgroundColor: tooltipFundo,
          titleColor: ink,
          bodyColor: ink,
          borderColor: tooltipBorda,
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          // Sem isto, o ano sem realizado ainda gera uma linha em branco.
          filter: (item) => item.parsed.y !== null,
          callbacks: {
            label: (ctx) => {
              const parcial = pts[ctx.dataIndex]?.parcial && ctx.datasetIndex === 1;
              return `${ctx.dataset.label}: ${ctx.parsed.y}%${parcial ? ' (ano em curso)' : ''}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: grade },
          ticks: { color: inkSecundaria },
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: grade },
          border: { display: false },
          ticks: {
            color: inkSecundaria,
            stepSize: 25,
            callback: (valor) => `${valor}%`,
          },
        },
      },
      color: ink,
    };
  });
}
