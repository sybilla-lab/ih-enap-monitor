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

      // As duas marcas são coloridas (verde-petróleo da Enap, vermelho do
      // Impact Hub). Nada de inverter ou tingir: cada uma aparece sobre uma
      // placa clara, que some no tema claro e garante leitura no escuro.
      &__logo {
        display: block;
        width: auto;
        object-fit: contain;
        padding: 5px 9px;
        border-radius: 8px;
        background: #ffffff;
      }

      // A Enap é a marca principal: maior e primeiro na leitura.
      &__logo--principal {
        height: 40px;
      }

      &__logo--apoio {
        height: 30px;
      }

      @media (max-width: 599px) {
        gap: 10px;

        &__rotulo {
          display: none;
        }

        &__logo--principal {
          height: 32px;
        }

        &__logo--apoio {
          height: 24px;
        }
      }
    }
  `,
})
export class MarcasComponent {
  readonly falhouEnap = signal(false);
  readonly falhouIh = signal(false);
}
