import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Stat tile (KPI): rótulo + valor + contexto. `tone="accent"` destaca o
 * indicador-herói da página (ex.: ROI) — use em no máximo um tile por view.
 */
@Component({
  selector: 'app-stat-tile',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="tile" [class.tile--accent]="tone() === 'accent'">
      <div class="tile__head">
        <span class="tile__label">{{ label() }}</span>
        @if (icon()) {
          <mat-icon class="tile__icon" aria-hidden="true">{{ icon() }}</mat-icon>
        }
      </div>
      <span class="tile__value">{{ value() }}</span>
      @if (hint()) {
        <span class="tile__hint">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    .tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      height: 100%;
      box-sizing: border-box;
      padding: 16px;
      background: var(--mat-sys-surface);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px;

      &__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      &__label {
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface-variant);
      }

      &__icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--mat-sys-on-surface-variant);
      }

      &__value {
        font: var(--mat-sys-headline-medium);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--mat-sys-on-surface);
      }

      &__hint {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      // Destaque por marca lateral, não por bloco colorido — mesma disciplina
      // do resto do painel: a cor fica reservada ao dado.
      &--accent {
        border-left: 3px solid var(--app-viz-accent);

        .tile__value {
          color: var(--app-viz-accent);
        }
      }
    }
  `,
})
export class StatTileComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>();
  readonly icon = input<string>();
  readonly tone = input<'default' | 'accent'>('default');
}
