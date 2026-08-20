import { Component, signal } from '@angular/core';

/**
 * Assinatura institucional das duas casas, presente em todas as páginas.
 *
 * A hierarquia é a pedida pelo cliente: a Enap vem primeiro e maior, o Impact
 * Hub Brasil depois e menor, separados por um fio. Os arquivos ficam em
 * `public/logos/` e NÃO são versionados junto com o resto — são material de
 * marca dos parceiros. Se um deles não estiver na pasta, o próprio elemento se
 * esconde: melhor a faixa aparecer incompleta do que a página exibir o ícone de
 * imagem quebrada.
 */
@Component({
  selector: 'app-marcas',
  standalone: true,
  template: `
    @if (!falhouEnap() || !falhouIh()) {
      <div class="marcas">
        <span class="marcas__rotulo">Uma parceria</span>

        @if (!falhouEnap()) {
          <img
            class="marcas__logo marcas__logo--principal"
            src="logos/enap.png"
            alt="Enap — Escola Nacional de Administração Pública"
            (error)="falhouEnap.set(true)"
          />
        }

        @if (!falhouEnap() && !falhouIh()) {
          <span class="marcas__fio" aria-hidden="true"></span>
        }

        @if (!falhouIh()) {
          <img
            class="marcas__logo marcas__logo--apoio"
            src="logos/impact-hub.png"
            alt="Impact Hub Brasil"
            (error)="falhouIh.set(true)"
          />
        }
      </div>
    }
  `,
  styles: `
    .marcas {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 16px;
      margin-bottom: 4px;

      &__rotulo {
        font: var(--mat-sys-label-medium);
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--mat-sys-on-surface-variant);
      }

      &__fio {
        width: 1px;
        height: 22px;
        background: var(--mat-sys-outline-variant);
      }

      &__logo {
        display: block;
        width: auto;
        object-fit: contain;

        // Logos costumam vir em versão escura; no tema escuro elas somem no
        // fundo. O filtro inverte só a luminosidade, preservando a leitura.
        :root[data-theme='dark'] & {
          filter: brightness(0) invert(1);
          opacity: 0.92;
        }
      }

      // A Enap é a marca principal: maior e primeiro na leitura.
      &__logo--principal {
        height: 36px;
      }

      &__logo--apoio {
        height: 24px;
      }

      @media (max-width: 599px) {
        gap: 10px;

        &__rotulo {
          display: none;
        }

        &__logo--principal {
          height: 28px;
        }

        &__logo--apoio {
          height: 20px;
        }
      }
    }
  `,
})
export class MarcasComponent {
  readonly falhouEnap = signal(false);
  readonly falhouIh = signal(false);
}
