import { Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '../../core/services/data.service';
import { ThemeService } from '../../core/services/theme.service';

/**
 * Porta de entrada do painel: sem planilha carregada, não há painel.
 *
 * O dashboard não guarda dados — o arquivo fica no navegador de quem abre, em
 * memória e em sessionStorage. É o que permite publicar o código num
 * repositório aberto sem publicar os indicadores da parceria.
 */
@Component({
  selector: 'app-carregar',
  standalone: true,
  imports: [MatIconModule, MatProgressBarModule],
  template: `
    <div class="tela">
      <button
        type="button"
        class="tela__tema"
        (click)="theme.toggle()"
        [attr.aria-label]="theme.mode() === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'"
      >
        <mat-icon aria-hidden="true">{{ theme.mode() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>

      <main class="painel">
        <header class="painel__marca">
          <span class="painel__selo" aria-hidden="true">IH</span>
          <span class="painel__nome">
            <strong>Enap × Impact Hub Brasil</strong>
            <small>Painel da Parceria · 2024–2028</small>
          </span>
        </header>

        <h1 class="painel__titulo">Carregue a planilha de indicadores</h1>
        <p class="painel__lead">
          O painel lê a Planilha Oficial de Indicadores direto no seu navegador. O arquivo não
          é enviado para lugar nenhum — nem para um servidor, nem para o repositório do projeto.
        </p>

        <label
          class="alvo"
          [class.alvo--sobre]="arrastando()"
          [class.alvo--ocupado]="dados.carregando()"
          (dragover)="aoArrastar($event, true)"
          (dragleave)="aoArrastar($event, false)"
          (drop)="aoSoltar($event)"
        >
          <input
            type="file"
            class="alvo__input"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            [disabled]="dados.carregando()"
            (change)="aoEscolher($event)"
          />
          <mat-icon class="alvo__icone" aria-hidden="true">upload_file</mat-icon>
          <span class="alvo__chamada">
            {{ dados.carregando() ? 'Lendo a planilha…' : 'Arraste a planilha aqui ou clique para escolher' }}
          </span>
          <span class="alvo__formato">Arquivo .xlsx · abas Metas, Parceria, Linha I, Linha II, agentes e organizações</span>
        </label>

        @if (dados.carregando()) {
          <mat-progress-bar mode="indeterminate" aria-label="Lendo a planilha" />
        }

        @if (dados.erro(); as erro) {
          <p class="erro" role="alert">
            <mat-icon aria-hidden="true">error_outline</mat-icon>
            <span>{{ erro }}</span>
          </p>
        }

        <ul class="notas">
          <li>
            <mat-icon aria-hidden="true">lock</mat-icon>
            Os dados ficam nesta aba do navegador e somem quando você a fecha.
          </li>
          <li>
            <mat-icon aria-hidden="true">visibility_off</mat-icon>
            Nomes e e-mails das abas de agentes não são lidos — o painel conta pessoas, não as
            identifica.
          </li>
          <li>
            <mat-icon aria-hidden="true">swap_horiz</mat-icon>
            Passo seguinte previsto: as mesmas telas consumindo uma API, sem esta etapa.
          </li>
        </ul>
      </main>
    </div>
  `,
  styles: `
    .tela {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 24px;
      background: var(--mat-sys-surface-container);

      &__tema {
        position: absolute;
        top: 16px;
        right: 16px;
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: var(--mat-sys-on-surface-variant);
        cursor: pointer;

        &:hover,
        &:focus-visible {
          background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
        }
      }
    }

    .painel {
      width: min(560px, 100%);
      padding: 32px;
      background: var(--mat-sys-surface);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 20px;

      &__marca {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 28px;
      }

      &__selo {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        flex: none;
        border-radius: 10px;
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
        font-size: 15px;
        font-weight: 800;
        letter-spacing: 0.5px;
      }

      &__nome {
        display: flex;
        flex-direction: column;
        line-height: 1.25;

        strong {
          font: var(--mat-sys-title-small);
          font-weight: 700;
        }

        small {
          font: var(--mat-sys-body-small);
          color: var(--mat-sys-on-surface-variant);
        }
      }

      &__titulo {
        margin: 0 0 8px;
        font-family: var(--app-font-display);
        font-size: 32px;
        font-weight: 600;
        line-height: 1.15;
        letter-spacing: -0.01em;
      }

      &__lead {
        margin: 0 0 24px;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }
    }

    // Área de soltar: o <label> inteiro é o alvo do clique e do arrasto.
    .alvo {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 32px 24px;
      border: 1px dashed color-mix(in srgb, var(--mat-sys-outline) 60%, transparent);
      border-radius: 16px;
      text-align: center;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease;

      &:hover,
      &:focus-within {
        border-color: var(--app-viz-accent);
        background: color-mix(in srgb, var(--mat-sys-primary) 4%, transparent);
      }

      &--sobre {
        border-color: var(--app-viz-accent);
        background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
      }

      &--ocupado {
        cursor: progress;
        opacity: 0.7;
      }

      &__input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }

      &__icone {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: var(--app-viz-accent);
      }

      &__chamada {
        font: var(--mat-sys-title-small);
        font-weight: 600;
      }

      &__formato {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }
    }

    mat-progress-bar {
      margin-top: 12px;
    }

    .erro {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 16px 0 0;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      font: var(--mat-sys-body-small);

      mat-icon {
        flex: none;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .notas {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 28px 0 0;
      padding: 20px 0 0;
      border-top: 1px solid var(--mat-sys-outline-variant);
      list-style: none;

      li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      mat-icon {
        flex: none;
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }
  `,
})
export class CarregarComponent {
  readonly dados = inject(DataService);
  readonly theme = inject(ThemeService);

  readonly arrastando = signal(false);

  aoEscolher(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    if (arquivo) void this.dados.carregarPlanilha(arquivo);
    input.value = ''; // permite recarregar o mesmo arquivo depois de um erro
  }

  aoArrastar(evento: DragEvent, sobre: boolean): void {
    evento.preventDefault();
    this.arrastando.set(sobre);
  }

  aoSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastando.set(false);
    const arquivo = evento.dataTransfer?.files?.[0];
    if (arquivo) void this.dados.carregarPlanilha(arquivo);
  }
}
