import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { GlobalFilterService } from '../../../core/services/global-filter.service';
import { FiltroEscopoService } from '../../../core/services/filtro-escopo.service';
import { DataService } from '../../../core/services/data.service';

/**
 * Dock de filtros: uma pílula flutuante fixa no topo, acima do conteúdo e do
 * shell, que acompanha o scroll. Fica em primeiro plano porque é o controle que
 * governa todos os números da página — e recolhe para um resumo de uma linha
 * quando o leitor quer a tela inteira de volta, sem perder o recorte aplicado.
 *
 * Sem dropdowns: anos são um segmented control (opções ordinais, um clique,
 * estado sempre visível) e linhas são chips-toggle. Cada página declara em
 * `data.filtros` o que responde; o dock só mostra isso (ver FiltroEscopoService).
 */
@Component({
  selector: 'app-filter-dock',
  standalone: true,
  imports: [MatIconModule],
  template: `
    @if (escopo.visivel()) {
      <div class="dock" [class.dock--min]="escopo.minimizado()">
        @if (escopo.minimizado()) {
          <button
            type="button"
            class="dock__resumo"
            [attr.aria-expanded]="false"
            aria-controls="dock-filtros"
            (click)="escopo.minimizado.set(false)"
          >
            <mat-icon aria-hidden="true">filter_list</mat-icon>
            <span class="dock__resumo-texto">{{ resumo() }}</span>
            @if (filtro.ativo()) { <span class="dock__ponto" aria-label="filtro ativo"></span> }
            <mat-icon class="dock__seta" aria-hidden="true">expand_more</mat-icon>
          </button>
        } @else {
          <div id="dock-filtros" class="dock__trilha" role="group" aria-label="Filtros do painel">
            <mat-icon class="dock__icone" aria-hidden="true">filter_list</mat-icon>

            @if (escopo.aceita('ano')) {
              <div class="grupo" role="group" aria-label="Filtrar por ano">
                <span class="grupo__rotulo">Ano</span>
                <div class="segmentos">
                  <button
                    type="button"
                    class="segmentos__botao"
                    [class.segmentos__botao--ativo]="filtro.ano() === null"
                    [attr.aria-pressed]="filtro.ano() === null"
                    (click)="filtro.ano.set(null)"
                  >
                    Acumulado
                  </button>
                  @for (ano of filtro.anos; track ano) {
                    <button
                      type="button"
                      class="segmentos__botao"
                      [class.segmentos__botao--ativo]="filtro.ano() === ano"
                      [class.segmentos__botao--futuro]="!anosComResultado().has(ano)"
                      [attr.aria-pressed]="filtro.ano() === ano"
                      [title]="
                        anosComResultado().has(ano) ? '' : 'Ainda sem resultados — mostra as metas de ' + ano
                      "
                      (click)="filtro.ano.set(ano)"
                    >
                      {{ ano }}
                    </button>
                  }
                </div>
              </div>
            }

            @if (escopo.aceita('linha')) {
              <div class="grupo" role="group" aria-label="Filtrar por linha de ação">
                <span class="grupo__rotulo">Linha</span>
                <div class="chips">
                  @for (linha of filtro.linhas; track linha.id) {
                    <button
                      type="button"
                      class="chips__chip"
                      [class.chips__chip--ativo]="filtro.linha() === linha.id"
                      [attr.aria-pressed]="filtro.linha() === linha.id"
                      [title]="linha.id + ' — ' + linha.nome"
                      (click)="filtro.alternarLinha(linha.id)"
                    >
                      {{ linha.id }}
                    </button>
                  }
                </div>
              </div>
            }

            @if (filtro.ativo()) {
              <button type="button" class="dock__limpar" (click)="filtro.limpar()">
                <mat-icon aria-hidden="true">close</mat-icon>
                Limpar
              </button>
            }
          </div>

          <button
            type="button"
            class="dock__toggle"
            aria-label="Recolher filtros"
            [attr.aria-expanded]="true"
            aria-controls="dock-filtros"
            (click)="escopo.minimizado.set(true)"
          >
            <mat-icon aria-hidden="true">expand_less</mat-icon>
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: fixed;
      top: 66px;
      left: 0;
      right: 0;
      z-index: 30;
      display: flex;
      justify-content: center;
      padding-inline: 12px;
      // Só a pílula recebe clique; o resto da faixa deixa o conteúdo passar.
      pointer-events: none;
    }

    // Acima de 959px o shell mantém a gaveta aberta: centraliza sobre o conteúdo.
    @media (min-width: 960px) {
      :host {
        left: 264px;
      }
    }

    .dock {
      display: flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      padding: 5px 5px 5px 12px;
      // Um degrau acima da superfície das páginas: sobre o fundo ou sobre um
      // card, o dock continua sendo outro plano quando o conteúdo passa por
      // baixo. Só o blur não bastava — a cor era a mesma dos cards.
      border: 1px solid color-mix(in srgb, var(--mat-sys-outline) 45%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-surface-container-highest) 94%, transparent);
      backdrop-filter: blur(12px);
      box-shadow: 0 10px 30px light-dark(rgb(0 0 0 / 0.18), rgb(0 0 0 / 0.55));
      pointer-events: auto;

      &--min {
        padding: 0;
      }
    }

    .dock__trilha {
      display: flex;
      align-items: center;
      gap: 8px 18px;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .dock__icone {
      flex: none;
      color: var(--mat-sys-on-surface-variant);
    }

    .dock__toggle,
    .dock__resumo {
      display: flex;
      align-items: center;
      flex: none;
      border: none;
      background: transparent;
      color: var(--mat-sys-on-surface-variant);
      font: inherit;
      cursor: pointer;
      border-radius: 999px;
      transition: background 120ms ease, color 120ms ease;

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
        color: var(--mat-sys-on-surface);
      }
    }

    .dock__toggle {
      justify-content: center;
      width: 34px;
      height: 34px;
    }

    .dock__resumo {
      gap: 8px;
      padding: 7px 8px 7px 12px;
      font: var(--mat-sys-label-large);

      &-texto {
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
    }

    .dock__ponto {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--app-viz-accent);
    }

    .dock__seta {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .dock__limpar {
      display: flex;
      align-items: center;
      gap: 2px;
      flex: none;
      padding: 6px 12px 6px 8px;
      border: none;
      border-radius: 999px;
      background: transparent;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-primary);
      cursor: pointer;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }
    }

    .grupo {
      display: flex;
      align-items: center;
      gap: 10px;

      &__rotulo {
        font: var(--mat-sys-label-medium);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .segmentos {
      display: inline-flex;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 999px;
      background: var(--mat-sys-surface);
      overflow: hidden;

      &__botao {
        padding: 7px 13px;
        border: none;
        border-left: 1px solid var(--mat-sys-outline-variant);
        background: transparent;
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface-variant);
        white-space: nowrap;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;

        &:first-child {
          border-left: none;
        }

        &:hover,
        &:focus-visible {
          background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
        }

        &--ativo {
          background: var(--mat-sys-primary-container);
          color: var(--mat-sys-on-primary-container);
          font-weight: 700;
        }

        &--futuro:not(.segmentos__botao--ativo) {
          opacity: 0.5;
        }
      }
    }

    .chips {
      display: inline-flex;
      gap: 6px;

      &__chip {
        padding: 7px 13px;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 999px;
        background: var(--mat-sys-surface);
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface-variant);
        white-space: nowrap;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease, border-color 120ms ease;

        &:hover,
        &:focus-visible {
          background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
        }

        &--ativo {
          background: var(--mat-sys-primary-container);
          border-color: transparent;
          color: var(--mat-sys-on-primary-container);
          font-weight: 700;
        }
      }
    }
  `,
})
export class FilterDockComponent {
  readonly filtro = inject(GlobalFilterService);
  readonly escopo = inject(FiltroEscopoService);
  private dados = inject(DataService);

  /** Anos que já têm algum resultado — os demais aparecem esmaecidos. */
  readonly anosComResultado = computed(() => {
    const anos = new Set<number>();
    for (const ind of this.dados.indicadores()) {
      for (const a of ind.anos) {
        if (a.realizado > 0) anos.add(a.ano);
      }
    }
    return anos;
  });

  /** Recorte em vigor, escrito por extenso — é o que o dock recolhido mostra. */
  readonly resumo = computed(() => {
    const partes: string[] = [];
    if (this.escopo.aceita('ano')) {
      const ano = this.filtro.ano();
      partes.push(ano === null ? 'Acumulado' : String(ano));
    }
    if (this.escopo.aceita('linha')) {
      partes.push(this.filtro.linha() ?? 'Todas as linhas');
    }
    return partes.join(' · ') || 'Filtros';
  });
}
