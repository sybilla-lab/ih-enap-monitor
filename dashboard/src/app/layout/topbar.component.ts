import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NAV_ITEMS, NAV_LINHAS } from './nav-items';
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
    <header
      class="barra"
      [class.barra--aberta]="menuAberto()"
      [class.barra--submenu]="linhasAbertas()"
    >
      <div class="barra__vidro">
        <div class="barra__linha">
          <!-- Versão negativa no tema escuro: é o que o brandbook da Enap
               determina para fundos escuros, em vez de tapar a marca com uma
               placa branca. -->
          <a class="marca" routerLink="/home" aria-label="Painel da Parceria Enap × Impact Hub">
            <img class="marca__enap" [src]="logoEnap()" alt="Enap" />
            <span class="marca__fio" aria-hidden="true"></span>
            <img class="marca__ih" [src]="logoIh()" alt="Impact Hub Brasil" />
          </a>

          <nav class="nav" [attr.aria-label]="'Seções do painel'">
            <a
              class="nav__item"
              [routerLink]="navItems[0].route"
              routerLinkActive="nav__item--ativo"
              (click)="fecharTudo()"
            >
              <mat-icon aria-hidden="true">{{ navItems[0].icon }}</mat-icon>
              <span>{{ navItems[0].label }}</span>
            </a>
            <a
              class="nav__item"
              [routerLink]="navItems[1].route"
              routerLinkActive="nav__item--ativo"
              (click)="fecharTudo()"
            >
              <mat-icon aria-hidden="true">{{ navItems[1].icon }}</mat-icon>
              <span>{{ navItems[1].label }}</span>
            </a>

            <!-- As quatro linhas num item só: elas são um grupo, e abertas na
                 barra empurravam o resto do menu para fora da tela. -->
            <div class="linhas-menu">
              <button
                type="button"
                class="nav__item nav__item--grupo"
                [class.nav__item--ativo]="linhaAtiva() !== null"
                [attr.aria-expanded]="linhasAbertas()"
                (click)="linhasAbertas.set(!linhasAbertas())"
              >
                <mat-icon aria-hidden="true">stacked_line_chart</mat-icon>
                <span>Linhas{{ linhaAtiva() ? ' · ' + linhaAtiva() : '' }}</span>
                <mat-icon class="nav__seta" aria-hidden="true">expand_more</mat-icon>
              </button>

              @if (linhasAbertas()) {
                <div class="submenu" role="menu">
                  @for (item of navLinhas; track item.route) {
                    <a
                      class="submenu__item"
                      role="menuitem"
                      [routerLink]="item.route"
                      routerLinkActive="submenu__item--ativo"
                      (click)="fecharTudo()"
                    >
                      <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                      <span class="submenu__texto">
                        <strong>{{ item.label }}</strong>
                        <small>{{ item.descricao }}</small>
                      </span>
                    </a>
                  }
                </div>
              }
            </div>

            @for (item of navItems.slice(2); track item.route) {
              <a
                class="nav__item"
                [routerLink]="item.route"
                routerLinkActive="nav__item--ativo"
                (click)="fecharTudo()"
              >
                <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                <span>{{ item.label }}</span>
              </a>
            }
          </nav>

          <div class="acoes">
            @if (escopo.visivel()) {
              <button
                type="button"
                class="gatilho"
                [class.gatilho--aberto]="escopo.aberto()"
                [attr.aria-expanded]="escopo.aberto()"
                aria-controls="painel-filtro"
                (click)="escopo.aberto.set(!escopo.aberto())"
              >
                <mat-icon aria-hidden="true">filter_list</mat-icon>
                <span class="gatilho__valor">{{ filtro.rotuloCurto() }}</span>
                <mat-icon class="gatilho__seta" aria-hidden="true">expand_more</mat-icon>
              </button>
            }

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

        <!-- Gaveta: o filtro não ocupa espaço até ser chamado. A transição é de
             grid-template-rows, que anima altura sem precisar de valor fixo. -->
        <div class="gaveta" [class.gaveta--aberta]="escopo.visivel() && escopo.aberto()">
          <div class="gaveta__conteudo">
            <div id="painel-filtro" class="filtro" role="group" aria-label="Filtrar por ano">
              <span class="filtro__rotulo">Ano</span>

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
            </div>
          </div>
        </div>
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
        // Recorta a gaveta do filtro nos cantos arredondados. Some quando o
        // submenu das linhas abre, senão o painel é cortado pela própria barra.
        overflow: hidden;
      }

      &--submenu &__vidro {
        overflow: visible;
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

      // Sem placa branca: cada tema usa a versão correta da marca.
      &__enap,
      &__ih {
        display: block;
        width: auto;
        object-fit: contain;
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
        border: none;
        border-radius: 999px;
        background: transparent;
        text-decoration: none;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-large);
        white-space: nowrap;
        cursor: pointer;
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

      &__seta {
        font-size: 17px;
        width: 17px;
        height: 17px;
        opacity: 0.8;
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

    // Gatilho do filtro: mostra o recorte atual e abre a gaveta.
    .gatilho {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px 6px 12px;
      margin-right: 4px;
      border: 1px solid color-mix(in srgb, var(--mat-sys-outline) 26%, transparent);
      border-radius: 999px;
      background: transparent;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease, color 140ms ease;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &__valor {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      &__seta {
        transition: transform 200ms ease;
      }

      &:hover,
      &:focus-visible {
        border-color: var(--app-viz-accent);
        color: var(--mat-sys-on-surface);
      }

      &--aberto {
        background: color-mix(in srgb, var(--app-viz-accent) 14%, transparent);
        border-color: transparent;
        color: var(--mat-sys-on-surface);

        .gatilho__seta {
          transform: rotate(180deg);
        }
      }
    }

    // Animar grid-template-rows de 0fr a 1fr desliza sem altura fixa.
    .gaveta {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 220ms ease;

      &__conteudo {
        overflow: hidden;
      }

      &--aberta {
        grid-template-rows: 1fr;
      }

      @media (prefers-reduced-motion: reduce) {
        transition: none;
      }
    }

    .filtro {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      padding: 10px 14px 12px;
      border-top: 1px solid color-mix(in srgb, var(--mat-sys-outline) 18%, transparent);

      &__rotulo {
        margin-right: 4px;
        font: var(--mat-sys-label-medium);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--mat-sys-on-surface-variant);
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

    }

    // Submenu das linhas: painel ancorado no item, no mesmo vidro da barra.
    .linhas-menu {
      position: relative;
    }

    .submenu {
      position: absolute;
      top: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: max-content;
      max-width: min(340px, 90vw);
      padding: 8px;
      border: 1px solid color-mix(in srgb, var(--mat-sys-outline) 30%, transparent);
      border-radius: 16px;
      background: color-mix(in srgb, var(--mat-sys-surface) 94%, transparent);
      backdrop-filter: blur(18px) saturate(1.4);
      box-shadow: 0 16px 40px light-dark(rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.5));

      &__item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 9px 12px;
        border-radius: 12px;
        text-decoration: none;
        color: inherit;
        transition: background 140ms ease;

        mat-icon {
          flex: none;
          margin-top: 1px;
          font-size: 19px;
          width: 19px;
          height: 19px;
          color: var(--mat-sys-on-surface-variant);
        }

        &:hover,
        &:focus-visible {
          background: color-mix(in srgb, var(--app-viz-accent) 12%, transparent);
        }

        &--ativo {
          background: var(--app-verde-enap);

          mat-icon,
          small {
            color: color-mix(in srgb, #ffffff 78%, transparent);
          }

          strong {
            color: #ffffff;
          }
        }
      }

      &__texto {
        display: flex;
        flex-direction: column;
        line-height: 1.3;

        strong {
          font: var(--mat-sys-label-large);
          font-weight: 600;
        }

        small {
          font: var(--mat-sys-body-small);
          color: var(--mat-sys-on-surface-variant);
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
  readonly navLinhas = NAV_LINHAS;
  readonly theme = inject(ThemeService);
  readonly dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);
  readonly escopo = inject(FiltroEscopoService);

  readonly menuAberto = signal(false);
  readonly linhasAbertas = signal(false);

  private router = inject(Router);

  /** Numeral da linha aberta ("II"), para o item do grupo dizer onde se está. */
  readonly linhaAtiva = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => {
        // Comparação exata, não por prefixo: "/linha-iv".startsWith("/linha-i")
        // é verdadeiro, e o menu marcava a Linha I em todas as outras.
        const caminho = this.router.url.split(/[?#]/)[0];
        const item = NAV_LINHAS.find((l) => caminho === l.route);
        return item ? item.label.replace('Linha ', '') : null;
      }),
    ),
    { initialValue: null },
  );

  /** Fecha submenu e menu móvel ao navegar. */
  fecharTudo(): void {
    this.linhasAbertas.set(false);
    this.menuAberto.set(false);
  }

  /** Clique fora ou Esc fecham o submenu das linhas. */
  @HostListener('document:click', ['$event'])
  aoClicarFora(evento: MouseEvent): void {
    if (!this.linhasAbertas()) return;
    const alvo = evento.target as HTMLElement;
    if (!alvo.closest('.linhas-menu')) this.linhasAbertas.set(false);
  }

  @HostListener('document:keydown.escape')
  aoApertarEsc(): void {
    this.linhasAbertas.set(false);
  }

  readonly logoEnap = computed(() =>
    this.theme.mode() === 'dark' ? 'logos/enap-negativa.png' : 'logos/enap.png',
  );

  readonly logoIh = computed(() =>
    this.theme.mode() === 'dark' ? 'logos/impact-hub-negativa.png' : 'logos/impact-hub.png',
  );

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
