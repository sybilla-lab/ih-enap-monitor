import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Kpi } from '../../../core/util/kpis.util';

/**
 * Detalhe de um indicador.
 *
 * O card responde "quanto"; esta janela responde "de onde saiu" — a série ano a
 * ano com meta e realizado, a composição quando o número é soma ou média de
 * outros, como o cálculo é feito e em que aba da planilha ele está. É a parte
 * do painel que permite auditar um número sem abrir a planilha.
 *
 * Usa o <dialog> nativo em vez de um overlay próprio: foco preso, Esc para
 * fechar e leitura de tela corretos sem nenhum código para isso.
 */
@Component({
  selector: 'app-kpi-detalhe',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <dialog #janela class="janela" (close)="fechar.emit()" (click)="aoClicarFora($event)">
      @if (kpi(); as k) {
        <article class="conteudo">
          <header class="cabecalho">
            <div>
              <p class="cabecalho__rotulo">{{ k.rotulo }}</p>
              <p class="cabecalho__valor">{{ k.valor }}</p>
              <p class="cabecalho__nota">{{ k.nota }}</p>
            </div>

            @if (k.meta; as meta) {
              <div class="progresso" [attr.aria-label]="meta.rotulo + ' da meta'">
                <span class="progresso__valor">{{ meta.rotulo }}</span>
                <span class="progresso__rotulo">da meta</span>
                <span class="progresso__trilho" role="presentation">
                  <span class="progresso__fill" [style.width.%]="meta.pct"></span>
                </span>
              </div>
            }

            <button type="button" class="fechar" (click)="fecharJanela()" aria-label="Fechar">
              <mat-icon aria-hidden="true">close</mat-icon>
            </button>
          </header>

          @if (barras().length) {
            <section class="bloco">
              <h3 class="bloco__titulo">Ano a ano</h3>
              <div class="serie">
                @for (b of barras(); track b.ano) {
                  <div class="ano" [class.ano--vazio]="!b.temValor">
                    <span class="ano__grafico">
                      @if (b.alturaMeta > 0) {
                        <span class="ano__meta" [style.height.%]="b.alturaMeta"></span>
                      }
                      <span class="ano__realizado" [style.height.%]="b.alturaValor"></span>
                    </span>
                    <span class="ano__valor">{{ b.rotulo }}</span>
                    @if (b.rotuloMeta) {
                      <span class="ano__meta-rotulo">meta {{ b.rotuloMeta }}</span>
                    }
                    <span class="ano__rotulo">{{ b.ano }}</span>
                  </div>
                }
              </div>
              @if (temMeta()) {
                <p class="legenda">
                  <span class="legenda__amostra legenda__amostra--realizado"></span> realizado
                  <span class="legenda__amostra legenda__amostra--meta"></span> meta do ano
                </p>
              }
            </section>
          }

          @if (k.detalhe.composicao; as composicao) {
            <section class="bloco">
              <h3 class="bloco__titulo">{{ k.detalhe.composicaoTitulo ?? 'Composição' }}</h3>
              <ul class="composicao">
                @for (item of composicao; track item.rotulo) {
                  <li class="composicao__item">
                    <span class="composicao__rotulo">
                      {{ item.rotulo }}
                      @if (item.nota) { <em>{{ item.nota }}</em> }
                    </span>
                    <span class="composicao__valor">{{ item.valor }}</span>
                  </li>
                }
              </ul>
            </section>
          }

          <section class="bloco bloco--metodo">
            <h3 class="bloco__titulo">Como este número é calculado</h3>
            <p class="metodo__texto">{{ k.detalhe.calculo }}</p>
            <p class="metodo__fonte">
              <mat-icon aria-hidden="true">table_chart</mat-icon>
              {{ k.detalhe.fonte }}
            </p>
          </section>
        </article>
      }
    </dialog>
  `,
  styles: `
    .janela {
      width: min(680px, calc(100vw - 32px));
      max-height: min(86vh, 900px);
      padding: 0;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 20px;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      box-shadow: 0 24px 60px light-dark(rgb(0 0 0 / 0.22), rgb(0 0 0 / 0.6));

      &::backdrop {
        background: light-dark(rgb(20 30 30 / 0.35), rgb(0 0 0 / 0.6));
        backdrop-filter: blur(3px);
      }

      &[open] {
        animation: entrar 180ms ease-out;
      }

      @media (prefers-reduced-motion: reduce) {
        &[open] {
          animation: none;
        }
      }
    }

    @keyframes entrar {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.99);
      }
    }

    .conteudo {
      padding: 22px 24px 24px;
    }

    .cabecalho {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: start;
      gap: 20px;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);

      &__rotulo {
        margin: 0;
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface-variant);
      }

      &__valor {
        margin: 4px 0 0;
        font-family: var(--app-font-display);
        font-size: 38px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }

      &__nota {
        margin: 8px 0 0;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .progresso {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      min-width: 108px;

      &__valor {
        font: var(--mat-sys-title-medium);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        color: var(--app-viz-accent);
      }

      &__rotulo {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      &__trilho {
        display: block;
        width: 108px;
        height: 5px;
        margin-top: 6px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--app-viz-accent) 16%, transparent);
        overflow: hidden;
      }

      &__fill {
        display: block;
        height: 100%;
        border-radius: 3px;
        background: var(--app-viz-accent);
      }
    }

    .fechar {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: var(--mat-sys-on-surface-variant);
      cursor: pointer;

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--app-viz-accent) 12%, transparent);
      }
    }

    .bloco {
      margin-top: 22px;

      &__titulo {
        margin: 0 0 12px;
        font: var(--mat-sys-label-large);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--mat-sys-on-surface-variant);
      }

      &--metodo {
        padding: 16px 18px;
        border-radius: 14px;
        background: var(--mat-sys-surface-container);
      }
    }

    // Série do ano: trilho claro é a meta, barra cheia é o realizado.
    .serie {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
    }

    .ano {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;

      &--vazio {
        opacity: 0.45;
      }

      &__grafico {
        position: relative;
        display: block;
        width: 100%;
        max-width: 54px;
        height: 96px;
      }

      &__meta,
      &__realizado {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: block;
        border-radius: 4px 4px 0 0;
      }

      &__meta {
        background: color-mix(in srgb, var(--app-viz-neutral) 28%, transparent);
      }

      &__realizado {
        background: var(--app-viz-accent);
        min-height: 2px;
      }

      &__valor {
        font: var(--mat-sys-body-medium);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      &__meta-rotulo,
      &__rotulo {
        font-size: 10px;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .legenda {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 12px 0 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);

      &__amostra {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 3px;
        margin-left: 8px;

        &:first-child {
          margin-left: 0;
        }

        &--realizado {
          background: var(--app-viz-accent);
        }

        &--meta {
          background: color-mix(in srgb, var(--app-viz-neutral) 28%, transparent);
        }
      }
    }

    .composicao {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;

      &__item {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        padding: 9px 0;
        border-top: 1px solid var(--mat-sys-outline-variant);

        &:first-child {
          border-top: none;
          padding-top: 0;
        }
      }

      &__rotulo {
        font: var(--mat-sys-body-medium);

        em {
          display: block;
          font-style: normal;
          font-size: 11px;
          color: var(--mat-sys-on-surface-variant);
        }
      }

      &__valor {
        flex: none;
        font: var(--mat-sys-body-medium);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
    }

    .metodo {
      &__texto {
        margin: 0;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      &__fonte {
        display: flex;
        align-items: center;
        gap: 7px;
        margin: 12px 0 0;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface);

        mat-icon {
          font-size: 17px;
          width: 17px;
          height: 17px;
          color: var(--app-viz-accent);
        }
      }
    }
  `,
})
export class KpiDetalheComponent {
  /** KPI aberto; null mantém a janela fechada. */
  readonly kpi = input<Kpi | null>(null);
  readonly fechar = output<void>();

  // O nome não pode colidir com a variável de template (#janela): no template,
  // a referência do elemento tem precedência sobre o membro da classe.
  private dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('janela');

  constructor() {
    effect(() => {
      const dialog = this.dialogo().nativeElement;
      if (this.kpi() && !dialog.open) dialog.showModal();
      else if (!this.kpi() && dialog.open) dialog.close();
    });
  }

  fecharJanela(): void {
    this.dialogo().nativeElement.close();
  }

  readonly temMeta = computed(() => (this.kpi()?.serie ?? []).some((p) => (p.meta ?? 0) > 0));

  readonly barras = computed(() => {
    const serie = this.kpi()?.serie ?? [];
    const maior = Math.max(...serie.map((p) => Math.max(p.valor, p.meta ?? 0)), 0);
    if (maior <= 0) return [];
    return serie.map((p) => ({
      ano: p.ano,
      rotulo: p.rotulo,
      rotuloMeta: p.rotuloMeta,
      temValor: p.valor > 0,
      alturaValor: (p.valor / maior) * 100,
      alturaMeta: ((p.meta ?? 0) / maior) * 100,
    }));
  });

  /** Clique no fundo (fora do conteúdo) fecha, como todo modal. */
  aoClicarFora(evento: MouseEvent): void {
    if (evento.target === this.dialogo().nativeElement) this.fecharJanela();
  }
}
