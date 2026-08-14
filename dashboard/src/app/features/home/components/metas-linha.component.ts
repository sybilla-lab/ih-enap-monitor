import { Component, computed, inject } from '@angular/core';
import { DataService } from '../../../core/services/data.service';
import { GlobalFilterService } from '../../../core/services/global-filter.service';
import { LINHAS_ACAO, LinhaAcaoId } from '../../../core/models/indicadores.model';
import { cumprimento } from '../../../core/util/agregacao.util';
import { formatPercentual } from '../../../core/util/numero.util';

interface LinhaProgresso {
  id: LinhaAcaoId;
  nome: string;
  pct: number;
  pctLabel: string;
  total: number;
  atingidos: number;
}

/**
 * Progresso das metas por linha de ação (docx: barras horizontais com
 * realizado × restante). Clicar numa linha aplica o filtro global — as demais
 * ficam esmaecidas (forma de ênfase), em vez de sumirem.
 */
@Component({
  selector: 'app-metas-linha',
  standalone: true,
  template: `
    <div class="linhas">
      @for (linha of linhas(); track linha.id) {
        <button
          type="button"
          class="linha"
          [class.linha--dim]="filtro.linha() !== null && filtro.linha() !== linha.id"
          [attr.aria-pressed]="filtro.linha() === linha.id"
          (click)="filtro.alternarLinha(linha.id)"
          [title]="'Média de cumprimento dos ' + linha.total + ' indicadores da ' + linha.id + '. Clique para filtrar o painel.'"
        >
          <span class="linha__cabecalho">
            <span class="linha__nome">
              <strong>{{ linha.id }}</strong>
              <span>{{ linha.nome }}</span>
            </span>
            <span class="linha__pct">{{ linha.pctLabel }}</span>
          </span>
          <span class="linha__meter" role="presentation">
            <span class="linha__meter-fill" [style.width.%]="linha.pct"></span>
          </span>
          <span class="linha__detalhe">
            {{ linha.total }} indicadores · {{ linha.atingidos }}
            {{ linha.atingidos === 1 ? 'atingido' : 'atingidos' }}
          </span>
        </button>
      }
    </div>
  `,
  styles: `
    .linhas {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .linha {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
      border: none;
      border-radius: 12px;
      background: transparent;
      font: inherit;
      text-align: left;
      color: inherit;
      cursor: pointer;
      transition: background 120ms ease, opacity 160ms ease;

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
      }

      &--dim {
        opacity: 0.4;
      }

      &__cabecalho {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      &__nome {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;

        strong {
          font: var(--mat-sys-title-small);
          white-space: nowrap;
        }

        span {
          font: var(--mat-sys-body-small);
          color: var(--mat-sys-on-surface-variant);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      &__pct {
        font: var(--mat-sys-title-small);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }

      &__meter {
        display: block;
        height: 10px;
        border-radius: 5px;
        background: color-mix(in srgb, var(--app-viz-accent) 14%, transparent);
        overflow: hidden;
      }

      &__meter-fill {
        display: block;
        height: 100%;
        min-width: 4px;
        border-radius: 0 5px 5px 0;
        background: var(--app-viz-accent);
      }

      &__detalhe {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }
    }
  `,
})
export class MetasLinhaComponent {
  private dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);

  readonly linhas = computed<LinhaProgresso[]>(() => {
    const indicadores = this.dados.indicadores();
    const ano = this.filtro.ano();
    return LINHAS_ACAO.map((linha) => {
      const c = cumprimento(
        indicadores.filter((i) => i.linha === linha.id),
        ano,
      );
      return {
        id: linha.id,
        nome: linha.nome,
        pct: c.pct,
        pctLabel: formatPercentual(c.pct),
        total: c.total,
        atingidos: c.atingidos,
      };
    }).filter((l) => l.total > 0);
  });
}
