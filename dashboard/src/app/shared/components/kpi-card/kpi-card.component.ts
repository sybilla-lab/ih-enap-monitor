import { Component, computed, input } from '@angular/core';
import { Kpi } from '../../../core/util/kpis.util';

/**
 * Card de KPI.
 *
 * O relevo vem de dado, não de enfeite: quando o indicador tem meta, o card
 * traz um anel com o quanto dela já foi cumprido; quando não tem, traz a série
 * ano a ano em barrinhas. A cor continua sendo só o vinho da marca em
 * intensidades diferentes — testamos um segundo tom da paleta e ele não se
 * distingue do vinho para quem tem daltonismo (ΔE abaixo do piso), então
 * hierarquia e forma fazem o trabalho que a cor faria.
 */
@Component({
  selector: 'app-kpi-card',
  standalone: true,
  template: `
    <article class="card" [class.card--destaque]="kpi().destaque">
      <header class="card__topo">
        <h3 class="card__rotulo">{{ kpi().rotulo }}</h3>

        @if (kpi().meta; as meta) {
          <span
            class="anel"
            [class.anel--completo]="meta.atingido"
            [attr.aria-label]="meta.rotulo + ' da meta'"
          >
            <svg viewBox="0 0 44 44" aria-hidden="true">
              <circle class="anel__trilho" cx="22" cy="22" r="18" />
              <circle
                class="anel__arco"
                cx="22"
                cy="22"
                r="18"
                [attr.stroke-dasharray]="perimetro"
                [attr.stroke-dashoffset]="offset()"
              />
            </svg>
            <span class="anel__valor">{{ meta.rotulo }}</span>
          </span>
        }
      </header>

      <p class="card__valor" [class.card__valor--longo]="valorLongo()">{{ kpi().valor }}</p>

      @if (!kpi().meta && barras().length) {
        <div class="serie" role="img" [attr.aria-label]="descricaoSerie()">
          @for (b of barras(); track b.ano) {
            <span class="serie__coluna" [title]="b.ano + ': ' + b.rotulo">
              <span class="serie__barra" [style.height.%]="b.altura"></span>
              <span class="serie__ano">{{ b.ano }}</span>
            </span>
          }
        </div>
      }

      <p class="card__nota">{{ kpi().nota }}</p>
    </article>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      padding: 14px 16px 13px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px;
      background: var(--mat-sys-surface);
      transition: border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;

      &:hover {
        border-color: color-mix(in srgb, var(--app-viz-accent) 40%, var(--mat-sys-outline-variant));
        transform: translateY(-2px);
        box-shadow: 0 10px 24px light-dark(rgb(0 0 0 / 0.07), rgb(0 0 0 / 0.32));
      }

      // Destaque: fundo tingido do próprio vinho e faixa no topo. Só dois
      // cards recebem isso — mais que isso e nada é destaque.
      &--destaque {
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--app-viz-accent) 9%, var(--mat-sys-surface)),
          var(--mat-sys-surface) 70%
        );
        border-color: color-mix(in srgb, var(--app-viz-accent) 32%, transparent);

        .card__valor {
          color: var(--app-viz-accent);
        }
      }

      &__topo {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        // Reserva a altura do anel para todos os cards: os rótulos de uma e de
        // duas linhas ficam alinhados entre si na grade.
        min-height: 40px;
      }

      &__rotulo {
        margin: 0;
        font: var(--mat-sys-label-large);
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
      }

      &__valor {
        margin: 4px 0 0;
        font-family: var(--app-font-display);
        font-size: clamp(28px, 2.8vw, 34px);
        font-weight: 600;
        line-height: 1.05;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;

        // Valores em R$ por extenso são longos por decisão de projeto; o card
        // acomoda o número inteiro em vez de cortá-lo ou abreviá-lo.
        &--longo {
          font-size: clamp(22px, 2.3vw, 28px);
          letter-spacing: -0.01em;
        }
      }

      &__nota {
        margin: auto 0 0;
        padding-top: 10px;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }
    }

    // Anel: quanto da meta do recorte já foi cumprido.
    .anel {
      position: relative;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      flex: none;

      svg {
        position: absolute;
        inset: 0;
        transform: rotate(-90deg);
      }

      &__trilho {
        fill: none;
        stroke: color-mix(in srgb, var(--app-viz-accent) 14%, transparent);
        stroke-width: 4;
      }

      &__arco {
        fill: none;
        stroke: var(--app-viz-accent);
        stroke-width: 4;
        stroke-linecap: round;
        transition: stroke-dashoffset 400ms ease;
      }

      &__valor {
        font-size: 11px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--mat-sys-on-surface-variant);
      }

      &--completo .anel__valor {
        color: var(--app-viz-accent);
      }
    }

    // Série anual: barras miúdas para os indicadores sem meta pactuada.
    .serie {
      display: flex;
      align-items: flex-end;
      gap: 5px;
      height: 34px;
      margin-top: 10px;

      &__coluna {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        flex: 1;
        height: 100%;
        gap: 4px;
      }

      &__barra {
        display: block;
        width: 100%;
        min-height: 2px;
        border-radius: 3px 3px 0 0;
        background: color-mix(in srgb, var(--app-viz-accent) 55%, transparent);
      }

      &__ano {
        font-size: 9px;
        color: var(--mat-sys-on-surface-variant);
      }
    }
  `,
})
export class KpiCardComponent {
  readonly kpi = input.required<Kpi>();

  /** Perímetro do círculo r=18, base do desenho do anel. */
  readonly perimetro = 2 * Math.PI * 18;

  /** "R$ 5.071.551,63" não cabe no corpo grande; acima de 11 caracteres reduz. */
  readonly valorLongo = computed(() => this.kpi().valor.length > 11);

  readonly offset = computed(() => {
    const pct = this.kpi().meta?.pct ?? 0;
    return this.perimetro * (1 - pct / 100);
  });

  readonly barras = computed(() => {
    const serie = this.kpi().serie ?? [];
    const maior = Math.max(...serie.map((s) => s.valor), 0);
    if (maior <= 0) return [];
    return serie.map((s) => ({
      ano: s.ano,
      rotulo: String(Math.round(s.valor * 10) / 10),
      altura: (s.valor / maior) * 100,
    }));
  });

  readonly descricaoSerie = computed(() =>
    this.barras()
      .map((b) => `${b.ano}: ${b.rotulo}`)
      .join(', '),
  );
}
