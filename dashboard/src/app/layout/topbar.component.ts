import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NAV_ITEMS } from './nav-items';
import { ThemeService } from '../core/services/theme.service';
import { DataService } from '../core/services/data.service';
import { GlobalFilterService } from '../core/services/global-filter.service';
import { FiltroEscopoService } from '../core/services/filtro-escopo.service';

/**
 * Navegação do painel: uma barra flutuante em vidro, presa ao topo.
 *
 * Substitui a gaveta lateral do Material — que ocupava 264px de largura fixa em
 * toda página e é o desenho que todo dashboard genérico tem. Sem ela, o
 * conteúdo usa a tela inteira (as tabelas de cinco anos e os cards largos
 * agradecem) e a marca fica no lugar onde a leitura começa.
 *
 * A barra reúne o que antes estava espalhado em três lugares: marca, menu e o
 * filtro de anos (que era um segundo elemento flutuante). Um controle só,
 * sempre visível, translúcido para o conteúdo continuar sendo o assunto.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  template: `
    <header class="barra" [class.barra--aberta]="menuAberto()">
      <div class="barra__vidro">
        <div class="barra__linha">
          <a class="marca" routerLink="/home" aria-label="Painel da Parceria Enap × Impact Hub">
            <img class="marca__enap" src="logos/enap.png" alt="Enap" />
            <span class="marca__fio" aria-hidden="true"></span>
            <img class="marca__ih" src="logos/impact-hub.png" alt="Impact Hub Brasil" />
          </a>

          <nav class="nav" [attr.aria-label]="'Seções do painel'">
            @for (item of navItems; track item.route) {
              <a
                class="nav__item"
                [routerLink]="item.route"
                routerLinkActive="nav__item--ativo"
                [matTooltip]="item.descricao ?? ''"
                matTooltipShowDelay="400"
                (click)="menuAberto.set(false)"
              >
                <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>

          <div class="acoes">
            @if (dados.origem(); as origem) {
              <button
                type="button"
                class="acoes__botao"
                [matTooltip]="'Planilha: ' + origem.arquivo + '. Clique para trocar.'"
                aria-label="Trocar planilha"
                (click)="dados.limpar()"
              >
                <mat-icon>swap_horiz</mat-icon>
              </button>
            }
            <button
              type="button"
              class="acoes__botao"
              [matTooltip]="theme.mode() === 'dark' ? 'Modo claro' : 'Modo escuro'"
              [attr.aria-label]="theme.mode() === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'"
              (click)="theme.toggle()"
            >
              <mat-icon>{{ theme.mode() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
            </button>
            <button
              type="button"
              class="acoes__botao acoes__botao--menu"
              [attr.aria-expanded]="menuAberto()"
              aria-label="Abrir menu"
              (click)="menuAberto.set(!menuAberto())"
            >
              <mat-icon>{{ menuAberto() ? 'close' : 'menu' }}</mat-icon>
            </button>
          </div>
        </div>

        @if (escopo.visivel()) {
          <div class="filtro" role="group" aria-label="Filtrar por ano">
            <span class="filtro__rotulo">
              <mat-icon aria-hidden="true">filter_list</mat-icon>
              Ano
            </span>

            <button
              type="button"
              class="filtro__opcao"
              [class.filtro__opcao--ativa]="!filtro.ativo()"
              [attr.aria-pressed]="!filtro.ativo()"
              (click)="filtro.limpar()"
            >
              Acumulado
            </button>

            @for (ano of filtro.anos; track ano) {
              <button
                type="button"
                class="filtro__opcao"
                [class.filtro__opcao--ativa]="filtro.selecionado(ano)"
                [class.filtro__opcao--futura]="!anosComResultado().has(ano)"
                [attr.aria-pressed]="filtro.selecionado(ano)"
                [title]="
                  anosComResultado().has(ano)
                    ? 'Clique para ver só ' + ano + '. Ctrl+clique soma ao recorte.'
                    : ano + ' ainda não tem resultados — mostra as metas do ano.'
                "
                (click)="escolher(ano, $event)"
              >
                {{ ano }}
              </button>
            }

            <span class="filtro__dica">
              @if (filtro.ativo()) {
                {{ filtro.rotuloCurto() }} · Ctrl+clique soma anos
              } @else {
                Ctrl+clique soma anos
              }
            </span>
          </div>
        }
      </div>
    </header>
  `,
  styles: `
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 40;
      padding: 12px 16px 0;
      pointer-events: none;
    }

    .barra {
      width: min(1400px, 100%);
      margin-inline: auto;
      pointer-events: auto;

      &__vidro {
        // O "vidro": translúcido com desfoque, para o conteúdo passar por baixo
        // sem sumir. A borda clara no topo é o que dá volume à peça.
        border: 1px solid color-mix(in srgb, var(--mat-sys-outline) 30%, transparent);
        border-radius: 20px;
        background: color-mix(in srgb, var(--mat-sys-surface) 72%, transparent);
        backdrop-filter: blur(18px) saturate(1.4);
        box-shadow:
          inset 0 1px 0 color-mix(in srgb, #fff 22%, transparent),
          0 12px 34px light-dark(rgb(0 0 0 / 0.12), rgb(0 0 0 / 0.45));
        overflow: hidden;
      }

      &__linha {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 12px 8px 14px;
      }
    }

    .marca {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: none;
      text-decoration: none;

      &__enap,
      &__ih {
        display: block;
        width: auto;
        object-fit: contain;
        padding: 4px 7px;
        border-radius: 7px;
        background: #ffffff;
      }

      // Enap é a marca principal; Impact Hub acompanha em escala menor.
      &__enap {
        height: 30px;
      }

      &__ih {
        height: 22px;
      }

      &__fio {
        width: 1px;
        height: 20px;
        background: color-mix(in srgb, var(--mat-sys-outline) 40%, transparent);
      }
    }

    .nav {
      display: flex;
      align-items: center;
      gap: 2px;
      flex: 1;
      min-width: 0;
      justify-content: center;

      &__item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-radius: 999px;
        text-decoration: none;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-large);
        white-space: nowrap;
        transition: background 140ms ease, color 140ms ease;

        mat-icon {
          font-size: 19px;
          width: 19px;
          height: 19px;
        }

        &:hover,
        &:focus-visible {
          background: color-mix(in srgb, var(--app-viz-accent) 12%, transparent);
          color: var(--mat-sys-on-surface);
        }

        &--ativo {
          background: var(--app-verde-enap);
          color: #ffffff;
          font-weight: 600;
        }
      }

      // Em telas médias, só os ícones — o rótulo vira tooltip.
      @media (max-width: 1300px) {
        &__item span {
          display: none;
        }

        &__item {
          padding: 8px 10px;
        }
      }
    }

    .acoes {
      display: flex;
      align-items: center;
      gap: 2px;
      flex: none;

      &__botao {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: var(--mat-sys-on-surface-variant);
        cursor: pointer;
        transition: background 140ms ease;

        &:hover,
        &:focus-visible {
          background: color-mix(in srgb, var(--app-viz-accent) 12%, transparent);
        }

        &--menu {
          display: none;
        }
      }
    }

    .filtro {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 14px 10px;
      border-top: 1px solid color-mix(in srgb, var(--mat-sys-outline) 18%, transparent);

      &__rotulo {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-right: 4px;
        font: var(--mat-sys-label-medium);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--mat-sys-on-surface-variant);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
        }
      }

      &__opcao {
        padding: 5px 13px;
        border: 1px solid color-mix(in srgb, var(--mat-sys-outline) 26%, transparent);
        border-radius: 999px;
        background: transparent;
        font: var(--mat-sys-label-large);
        font-variant-numeric: tabular-nums;
        color: var(--mat-sys-on-surface-variant);
        cursor: pointer;
        transition: background 140ms ease, color 140ms ease, border-color 140ms ease;

        &:hover,
        &:focus-visible {
          border-color: var(--app-viz-accent);
          color: var(--mat-sys-on-surface);
        }

        &--ativa {
          background: var(--app-viz-accent);
          border-color: transparent;
          color: #ffffff;
          font-weight: 600;
        }

        &--futura:not(.filtro__opcao--ativa) {
          opacity: 0.45;
        }
      }

      &__dica {
        margin-left: auto;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);

        @media (max-width: 899px) {
          display: none;
        }
      }
    }

    // No celular a barra vira uma linha só e o menu abre embaixo dela.
    @media (max-width: 1023px) {
      .nav {
        position: absolute;
        left: 0;
        right: 0;
        top: 100%;
        display: none;
        flex-direction: column;
        align-items: stretch;
        padding: 8px;
        gap: 2px;
      }

      .barra--aberta .nav {
        display: flex;
      }

      .barra--aberta .barra__vidro {
        overflow: visible;
      }

      .nav__item span {
        display: inline !important;
      }

      .acoes__botao--menu {
        display: grid;
      }

      .barra__linha {
        position: relative;
      }
    }
  `,
})
export class TopbarComponent {
  readonly navItems = NAV_ITEMS;
  readonly theme = inject(ThemeService);
  readonly dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);
  readonly escopo = inject(FiltroEscopoService);

  readonly menuAberto = signal(false);

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

  /** Ctrl (ou Cmd, no Mac) soma o ano ao recorte em vez de trocá-lo. */
  escolher(ano: number, evento: MouseEvent): void {
    this.filtro.alternar(ano, evento.ctrlKey || evento.metaKey);
  }
}
