import { Component, input } from '@angular/core';

export interface AnoDoIndicador {
  ano: number;
  meta: string;
  realizado: string;
  /** Altura da barra de meta, 0–100, na escala do maior ano do indicador. */
  alturaMeta: number;
  alturaRealizado: number;
  pctLabel: string;
  atingido: boolean;
  emCurso: boolean;
  vazio: boolean;
  selecionado: boolean;
}

export interface IndicadorApresentado {
  nome: string;
  unidade: string;
  /** Indicador em R$: os rótulos são longos e pedem a fileira inteira. */
  largo: boolean;
  totalMeta: string;
  totalRealizado: string;
  pct: number;
  pctLabel: string;
  atingido: boolean;
  anos: AnoDoIndicador[];
}

/**
 * Um indicador da linha como card, não como linha de planilha.
 *
 * A tabela de cinco anos × meta/realizado obrigava a rolar na horizontal e
 * reproduzia a leitura do Sheets — que o painel existe para substituir. Aqui
 * cada indicador ganha o número que importa (acumulado contra a meta) e, ao
 * lado, a série de anos em colunas: trilho claro é a meta do ano, barra cheia é
 * o realizado. Compara-se a olho, sem procurar célula.
 */
@Component({
  selector: 'app-indicador-card',
  standalone: true,
  template: `
    <article class="ind">
      <header class="ind__cabecalho">
        <h3 class="ind__nome">{{ dados().nome }}</h3>
        <span class="ind__unidade">{{ dados().unidade }}</span>
      </header>

      <div class="ind__corpo">
        <div class="acumulado">
          <span class="acumulado__valor" [class.acumulado__valor--ok]="dados().atingido">
            {{ dados().totalRealizado }}
          </span>
          <span class="acumulado__meta">de {{ dados().totalMeta }} até 2028</span>
          <span class="acumulado__barra" role="presentation">
            <span class="acumulado__fill" [style.width.%]="dados().pct"></span>
          </span>
          <span class="acumulado__pct">{{ dados().pctLabel }} da meta</span>
        </div>

        <div class="anos" role="img" [attr.aria-label]="descricao()">
          @for (a of dados().anos; track a.ano) {
            <div
              class="ano"
              [class.ano--selecionado]="a.selecionado"
              [class.ano--vazio]="a.vazio"
              [title]="a.ano + ': realizado ' + a.realizado + ' de meta ' + a.meta"
            >
              <span class="ano__grafico">
                <span class="ano__meta" [style.height.%]="a.alturaMeta"></span>
                <span class="ano__realizado" [style.height.%]="a.alturaRealizado"></span>
              </span>
              <span class="ano__valor" [class.ano__valor--ok]="a.atingido">
                {{ a.vazio ? '—' : a.realizado }}
              </span>
              <span class="ano__rotulo">
                {{ a.ano }}
                @if (a.emCurso && !a.vazio) { <em>em curso</em> }
              </span>
            </div>
          }
        </div>
      </div>
    </article>
  `,
  styles: `
    .ind {
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      padding: 16px 18px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px;
      background: var(--mat-sys-surface);

      &__cabecalho {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      &__nome {
        margin: 0;
        font: var(--mat-sys-body-medium);
        font-weight: 500;
      }

      &__unidade {
        flex: none;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.7px;
        color: var(--mat-sys-on-surface-variant);
      }

      &__corpo {
        display: grid;
        grid-template-columns: minmax(150px, 200px) 1fr;
        gap: 22px;
        align-items: end;

        @media (max-width: 699px) {
          grid-template-columns: 1fr;
          gap: 16px;
        }
      }
    }

    .acumulado {
      display: flex;
      flex-direction: column;
      gap: 2px;

      &__valor {
        font-family: var(--app-font-display);
        font-size: 30px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.01em;
        font-variant-numeric: tabular-nums;

        &--ok {
          color: var(--app-viz-accent);
        }
      }

      &__meta {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      &__barra {
        display: block;
        height: 6px;
        margin-top: 6px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--app-viz-accent) 14%, transparent);
        overflow: hidden;
      }

      &__fill {
        display: block;
        height: 100%;
        min-width: 3px;
        border-radius: 3px;
        background: var(--app-viz-accent);
      }

      &__pct {
        margin-top: 3px;
        font: var(--mat-sys-body-small);
        font-variant-numeric: tabular-nums;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    // Série de anos: trilho = meta do ano, barra = realizado.
    .anos {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }

    .ano {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 6px 2px 4px;
      border-radius: 8px;

      &--selecionado {
        background: color-mix(in srgb, var(--app-viz-accent) 10%, transparent);
      }

      &--vazio {
        opacity: 0.45;
      }

      &__grafico {
        position: relative;
        display: block;
        width: 100%;
        max-width: 34px;
        height: 54px;
      }

      &__meta,
      &__realizado {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: block;
        border-radius: 3px 3px 0 0;
      }

      &__meta {
        background: color-mix(in srgb, var(--app-viz-neutral) 26%, transparent);
      }

      &__realizado {
        background: var(--app-viz-accent);
      }

      &__valor {
        font: var(--mat-sys-body-small);
        font-weight: 600;
        font-variant-numeric: tabular-nums;

        &--ok {
          color: var(--app-viz-accent);
        }
      }

      &__rotulo {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 10px;
        color: var(--mat-sys-on-surface-variant);

        em {
          font-style: normal;
          font-size: 9px;
          opacity: 0.85;
        }
      }
    }
  `,
})
export class IndicadorCardComponent {
  readonly dados = input.required<IndicadorApresentado>();

  descricao(): string {
    return this.dados()
      .anos.map((a) => `${a.ano}: ${a.vazio ? 'sem meta' : `${a.realizado} de ${a.meta}`}`)
      .join('; ');
  }
}
