import { Component, computed, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '../../core/services/data.service';
import { GlobalFilterService } from '../../core/services/global-filter.service';
import { cumprimento } from '../../core/util/agregacao.util';
import { formatPercentual } from '../../core/util/numero.util';
import { MetasLinhaComponent } from './components/metas-linha.component';
import { AvancoChartComponent } from './components/avanco-chart.component';

/**
 * Progresso das Metas: a leitura consolidada que antes abria o painel.
 *
 * Saiu da Home a pedido do cliente — a Home passou a responder "o que a
 * parceria entregou" e esta página responde "o quanto disso era o combinado".
 * O conteúdo é o mesmo: cumprimento médio, progresso por linha e o avanço
 * rumo à meta de 2028.
 */
@Component({
  selector: 'app-progresso',
  standalone: true,
  imports: [MatProgressBarModule, MetasLinhaComponent, AvancoChartComponent],
  templateUrl: './progresso.component.html',
  styleUrl: './progresso.component.scss',
})
export class ProgressoComponent {
  readonly dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);

  /** O número que a página lidera: cumprimento médio das metas do recorte. */
  readonly destaque = computed(() => {
    const c = cumprimento(this.dados.indicadores(), this.filtro.recorte());
    return {
      pct: c.pct,
      valor: formatPercentual(c.pct),
      nota: `${c.atingidos} de ${c.total} indicadores atingidos · ${this.filtro.rotulo()}`,
    };
  });
}
