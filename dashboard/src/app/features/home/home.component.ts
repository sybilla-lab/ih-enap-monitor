import { Component, computed, inject, signal } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '../../core/services/data.service';
import { GlobalFilterService } from '../../core/services/global-filter.service';
import { formatMoeda, formatQuantidade } from '../../core/util/numero.util';
import { Kpi, kpisDaParceria } from '../../core/util/kpis.util';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { KpiDetalheComponent } from '../../shared/components/kpi-card/kpi-detalhe.component';

/**
 * Home: o retrato da parceria em números, sem análise.
 *
 * O progresso das metas (cumprimento, evolução, linhas) mudou-se para a página
 * "Progresso das Metas" a pedido do cliente — aqui ficam os indicadores de
 * entrega que respondem "o que a parceria produziu até agora", cada um com a
 * origem declarada na nota.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MatProgressBarModule, KpiCardComponent, KpiDetalheComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);

  /** Indicador aberto no detalhe; null = janela fechada. */
  readonly detalhe = signal<Kpi | null>(null);

  readonly fatos = computed(() => {
    const financeiro = this.dados.indicadores().find((i) => i.unidade === 'moeda');
    return [
      { rotulo: 'Vigência', valor: '2023–2028' },
      { rotulo: 'Linhas de ação', valor: '4' },
      {
        rotulo: 'Indicadores acompanhados',
        valor: formatQuantidade(this.dados.indicadores().length),
      },
      {
        rotulo: 'Meta de captação',
        valor: financeiro ? formatMoeda(financeiro.metaTotal) : '—',
      },
    ];
  });

  readonly kpis = computed(() =>
    kpisDaParceria(
      this.dados.indicadores(),
      this.dados.entregas(),
      this.dados.parceria(),
      this.filtro.recorte(),
      this.filtro.rotulo(),
    ),
  );
}
