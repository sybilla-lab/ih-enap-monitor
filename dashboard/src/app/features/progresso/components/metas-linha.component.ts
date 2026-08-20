import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DataService } from '../../../core/services/data.service';
import { GlobalFilterService } from '../../../core/services/global-filter.service';
import { LINHAS_ACAO, LinhaAcaoId } from '../../../core/models/indicadores.model';
import { cumprimento } from '../../../core/util/agregacao.util';
import { formatPercentual } from '../../../core/util/numero.util';

interface LinhaProgresso {
  id: LinhaAcaoId;
  nome: string;
  rota: string;
  pct: number;
  pctLabel: string;
  total: number;
  atingidos: number;
}

const ROTAS: Record<LinhaAcaoId, string> = {
  'Linha I': '/linha-i',
  'Linha II': '/linha-ii',
  'Linha III': '/linha-iii',
  'Linha IV': '/linha-iv',
};

/**
 * Progresso das metas por linha de ação (docx: barras horizontais com realizado
 * × restante). Cada linha é um link para a página da própria linha — antes o
 * clique aplicava um filtro global, que deixou de existir quando as linhas
 * viraram páginas.
 */
@Component({
  selector: 'app-metas-linha',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="linhas">
      @for (linha of linhas(); track linha.id) {
        <a
          class="linha"
          [routerLink]="linha.rota"
          [title]="'Abrir a página da ' + linha.id + ' — ' + linha.nome"
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
            <mat-icon aria-hidden="true">arrow_forward</mat-icon>
          </span>
        </a>
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
      border-radius: 12px;
      text-decoration: none;
      color: inherit;
      transition: background 120ms ease;

      &:hover,
      &:focus-visible {
        background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);

        .linha__detalhe mat-icon {
          opacity: 1;
          transform: translateX(2px);
        }
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
        display: flex;
        align-items: center;
        gap: 4px;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);

        mat-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
          opacity: 0;
          transition: opacity 120ms ease, transform 120ms ease;
        }
      }
    }
  `,
})
export class MetasLinhaComponent {
  private dados = inject(DataService);
  private filtro = inject(GlobalFilterService);

  readonly linhas = computed<LinhaProgresso[]>(() => {
    const indicadores = this.dados.indicadores();
    const ano = this.filtro.recorte();
    return LINHAS_ACAO.map((linha) => {
      const c = cumprimento(
        indicadores.filter((i) => i.linha === linha.id),
        ano,
      );
      return {
        id: linha.id,
        nome: linha.nome,
        rota: ROTAS[linha.id],
        pct: c.pct,
        pctLabel: formatPercentual(c.pct),
        total: c.total,
        atingidos: c.atingidos,
      };
    }).filter((l) => l.total > 0);
  });
}
