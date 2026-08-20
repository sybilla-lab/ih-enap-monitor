import { Component, computed, input, signal } from '@angular/core';
import { formatMoeda } from '../../../core/util/numero.util';

const TETO_APORTE = 3_000_000;
const PASSO = 50_000;

/**
 * Simulador de alavancagem: aplica a um novo aporte a alavancagem que a parceria
 * já demonstrou. Deliberadamente não inventa cenário — o valor central é o
 * acumulado observado e a faixa vem do melhor e do pior ano reais, para que a
 * leitura seja "isto já aconteceu nesta proporção", não "isto vai acontecer".
 */
@Component({
  selector: 'app-simulador-alavancagem',
  standalone: true,
  template: `
    <div class="sim">
      <div class="sim__controle">
        <label class="sim__rotulo" for="aporte-simulado">Novo aporte da Enap</label>
        <output class="sim__aporte" for="aporte-simulado">{{ moeda(aporte()) }}</output>
        <input
          id="aporte-simulado"
          class="sim__slider"
          type="range"
          [min]="0"
          [max]="teto"
          [step]="passo"
          [value]="aporte()"
          [attr.aria-valuetext]="moeda(aporte())"
          (input)="ajustar($event)"
        />
        <div class="sim__escala">
          <span>{{ moeda(0) }}</span>
          <span>{{ moeda(teto) }}</span>
        </div>
      </div>

      <div class="sim__resultado" aria-live="polite">
        <p class="sim__rotulo">Captação projetada</p>
        <p class="sim__valor">{{ moeda(projecao()) }}</p>

        <div class="regua regua--compacta" role="presentation">
          <span class="regua__barra regua__barra--aporte" [style.width.%]="larguraAporte()"></span>
          <span class="regua__barra regua__barra--captado"></span>
        </div>

        <dl class="sim__detalhe">
          <div>
            <dt>Faixa observada ({{ fatorTexto() }})</dt>
            <dd>{{ moeda(projecaoMin()) }} a {{ moeda(projecaoMax()) }}</dd>
          </div>
          <div>
            <dt>Retorno líquido projetado</dt>
            <dd>{{ moeda(projecao() - aporte()) }}</dd>
          </div>
        </dl>

        <p class="sim__aviso">
          Projeção, não compromisso: aplica a alavancagem já observada na parceria a um aporte
          hipotético.
        </p>
      </div>
    </div>
  `,
  styles: `
    .sim {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) minmax(260px, 1fr);
      gap: 24px;
      align-items: start;

      @media (max-width: 899px) {
        grid-template-columns: 1fr;
      }

      &__controle {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      &__rotulo {
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface-variant);
      }

      &__aporte {
        font: var(--mat-sys-headline-small);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      &__slider {
        width: 100%;
        margin: 8px 0 0;
        accent-color: var(--app-viz-accent);
        cursor: pointer;

        &:focus-visible {
          outline: 2px solid var(--mat-sys-primary);
          outline-offset: 4px;
          border-radius: 4px;
        }
      }

      &__escala {
        display: flex;
        justify-content: space-between;
        font: var(--mat-sys-body-small);
        font-variant-numeric: tabular-nums;
        color: var(--mat-sys-on-surface-variant);
      }

      &__resultado {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-left: 24px;
        border-left: 1px solid var(--mat-sys-outline-variant);

        @media (max-width: 899px) {
          padding: 20px 0 0;
          border-left: none;
          border-top: 1px solid var(--mat-sys-outline-variant);
        }
      }

      &__valor {
        margin: 0;
        font-family: var(--app-font-display);
        font-size: clamp(32px, 4vw, 42px);
        font-weight: 600;
        line-height: 1.05;
        font-variant-numeric: tabular-nums;
      }

      &__detalhe {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 32px;
        margin: 4px 0 0;

        dt {
          font: var(--mat-sys-body-small);
          color: var(--mat-sys-on-surface-variant);
        }

        dd {
          margin: 2px 0 0;
          font: var(--mat-sys-body-medium);
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
      }

      &__aviso {
        margin: 4px 0 0;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }
    }

    // Mesma linguagem da régua do real, em escala reduzida.
    .regua--compacta {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .regua__barra {
        display: block;
        height: 10px;
        border-radius: 0 5px 5px 0;
        min-width: 2px;
      }

      .regua__barra--aporte {
        background: var(--app-viz-neutral);
      }

      .regua__barra--captado {
        width: 100%;
        background: var(--app-viz-accent);
      }
    }
  `,
})
export class SimuladorAlavancagemComponent {
  /** Alavancagem acumulada da parceria (R$ captados por R$ 1 aportado). */
  readonly alavancagem = input.required<number>();
  readonly faixaMin = input<number | null>(null);
  readonly faixaMax = input<number | null>(null);

  readonly moeda = formatMoeda;
  readonly teto = TETO_APORTE;
  readonly passo = PASSO;

  readonly aporte = signal(1_000_000);

  readonly projecao = computed(() => this.aporte() * this.alavancagem());
  readonly projecaoMin = computed(() => this.aporte() * (this.faixaMin() ?? this.alavancagem()));
  readonly projecaoMax = computed(() => this.aporte() * (this.faixaMax() ?? this.alavancagem()));

  readonly larguraAporte = computed(() => {
    const projetado = this.projecao();
    return projetado > 0 ? (this.aporte() / projetado) * 100 : 0;
  });

  readonly fatorTexto = computed(() => {
    const min = this.faixaMin();
    const max = this.faixaMax();
    if (min === null || max === null) return `${fator(this.alavancagem())}×`;
    return `${fator(min)}× a ${fator(max)}×`;
  });

  ajustar(evento: Event): void {
    this.aporte.set(Number((evento.target as HTMLInputElement).value));
  }
}

function fator(v: number): string {
  return v.toFixed(1).replace('.', ',');
}
