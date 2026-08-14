import { Component, computed, input, output, signal } from '@angular/core';
import { UF_GRID, UfInfo } from '../../../core/models/territorio.model';

interface Tile extends UfInfo {
  alcance: number;
  bucket: 0 | 1 | 2 | 3;
}

/**
 * Cartograma de tiles do Brasil. Cada UF é um quadrado numa grade, colorido
 * pela intensidade de alcance (nº de frentes que tocaram o estado). Não é
 * um mapa geográfico — é uma escolha deliberada: os dados são de presença por
 * estado, e o tile-grid comunica isso com honestidade e leveza.
 */
@Component({
  selector: 'app-brazil-tilemap',
  standalone: true,
  template: `
    <div class="mapa">
      <div class="grade" role="img" aria-label="Mapa de alcance da parceria por estado">
        @for (t of tiles(); track t.sigla) {
          <button
            type="button"
            class="tile"
            [class.tile--b0]="t.bucket === 0"
            [class.tile--b1]="t.bucket === 1"
            [class.tile--b2]="t.bucket === 2"
            [class.tile--b3]="t.bucket === 3"
            [class.tile--sel]="selecionada() === t.sigla"
            [class.tile--fixa]="fixada() === t.sigla"
            [style.grid-row]="t.linha + 1"
            [style.grid-column]="t.coluna + 1"
            [attr.aria-label]="t.nome + ': ' + rotulo(t.alcance) + '. Clique para ver as iniciativas.'"
            [attr.aria-pressed]="fixada() === t.sigla"
            (mouseenter)="selecionar.emit(t.sigla)"
            (focus)="selecionar.emit(t.sigla)"
            (mouseleave)="selecionar.emit(null)"
            (blur)="selecionar.emit(null)"
            (click)="fixar.emit(t.sigla)"
          >
            {{ t.sigla }}
            @if (comOrg().has(t.sigla)) {
              <span class="tile__org" aria-hidden="true"></span>
            }
          </button>
        }
      </div>

      <div class="legenda" aria-hidden="true">
        <span class="legenda__rotulo">Menos</span>
        <span class="legenda__amostra legenda__amostra--b1"></span>
        <span class="legenda__amostra legenda__amostra--b2"></span>
        <span class="legenda__amostra legenda__amostra--b3"></span>
        <span class="legenda__rotulo">Mais frentes</span>
        <span class="legenda__sep"></span>
        <span class="legenda__amostra legenda__amostra--b0"></span>
        <span class="legenda__rotulo">Sem registro</span>
      </div>
    </div>
  `,
  styles: `
    .mapa {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .grade {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      grid-auto-rows: 1fr;
      gap: 6px;
      aspect-ratio: 7 / 9;
      max-width: 420px;
    }

    .tile {
      position: relative;
      display: grid;
      place-items: center;
      border: none;
      border-radius: 8px;
      padding: 0;
      font: var(--mat-sys-label-small);
      font-weight: 700;
      letter-spacing: 0.3px;
      cursor: pointer;
      transition: transform 100ms ease, outline-color 100ms ease;
      outline: 2px solid transparent;
      outline-offset: 2px;

      &--b0 {
        background: var(--mat-sys-surface-container-high);
        color: var(--mat-sys-on-surface-variant);
        opacity: 0.55;
      }
      &--b1 {
        background: color-mix(in srgb, var(--app-viz-accent) 28%, var(--mat-sys-surface));
        color: var(--mat-sys-on-surface);
      }
      &--b2 {
        background: color-mix(in srgb, var(--app-viz-accent) 60%, var(--mat-sys-surface));
        color: var(--mat-sys-on-surface);
      }
      &--b3 {
        background: var(--app-viz-accent);
        color: #ffffff;
      }

      &:hover,
      &:focus-visible,
      &--sel {
        transform: scale(1.08);
        outline-color: var(--mat-sys-on-surface);
      }

      // Estado fixado por clique: continua marcado depois que o mouse sai.
      &--fixa {
        transform: scale(1.08);
        outline-color: var(--app-viz-accent);
        outline-width: 3px;
      }

      // Marca os estados que aparecem no ranking de organizações — torna o
      // vínculo mapa ↔ organizações descobrível.
      &__org {
        position: absolute;
        top: 3px;
        right: 3px;
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.8;
      }
    }

    .legenda {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;

      &__rotulo {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      &__amostra {
        width: 16px;
        height: 16px;
        border-radius: 4px;

        &--b0 {
          background: var(--mat-sys-surface-container-high);
          opacity: 0.55;
        }
        &--b1 {
          background: color-mix(in srgb, var(--app-viz-accent) 28%, var(--mat-sys-surface));
        }
        &--b2 {
          background: color-mix(in srgb, var(--app-viz-accent) 60%, var(--mat-sys-surface));
        }
        &--b3 {
          background: var(--app-viz-accent);
        }
      }

      &__sep {
        width: 1px;
        height: 16px;
        margin: 0 6px;
        background: var(--mat-sys-outline-variant);
      }
    }
  `,
})
export class BrazilTilemapComponent {
  readonly alcancePorUf = input.required<Record<string, number>>();
  /** UF em preview (hover/foco de teclado). */
  readonly selecionada = input<string | null>(null);
  /** UF fixada por clique — é a que abre o painel de detalhe. */
  readonly fixada = input<string | null>(null);
  readonly comOrg = input<Set<string>>(new Set());
  readonly selecionar = output<string | null>();
  readonly fixar = output<string>();

  readonly tiles = computed<Tile[]>(() => {
    const alc = this.alcancePorUf();
    return UF_GRID.map((uf) => {
      const alcance = alc[uf.sigla] ?? 0;
      return { ...uf, alcance, bucket: bucketDe(alcance) };
    });
  });

  rotulo(alcance: number): string {
    if (alcance === 0) return 'sem registro de alcance';
    // "Frente" e não "iniciativa": o alcance de um estado soma as iniciativas
    // que chegaram lá e as prefeituras com agentes públicos engajados.
    return `${alcance} ${alcance === 1 ? 'frente' : 'frentes'}`;
  }
}

function bucketDe(alcance: number): 0 | 1 | 2 | 3 {
  if (alcance <= 0) return 0;
  if (alcance === 1) return 1;
  if (alcance <= 3) return 2;
  return 3;
}
