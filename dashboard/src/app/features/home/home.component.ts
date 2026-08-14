import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '../../core/services/data.service';
import { GlobalFilterService } from '../../core/services/global-filter.service';
import { Indicador, LINHAS_ACAO } from '../../core/models/indicadores.model';
import { cumprimento, valoresDoRecorte } from '../../core/util/agregacao.util';
import { formatMoeda, formatPercentual, formatQuantidade } from '../../core/util/numero.util';
import { MetasLinhaComponent } from './components/metas-linha.component';
import { AvancoChartComponent } from './components/avanco-chart.component';

interface Fato {
  rotulo: string;
  valor: string;
}

interface Kpi extends Fato {
  nota?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    MatIconModule,
    MatProgressBarModule,
    MetasLinhaComponent,
    AvancoChartComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);

  private indicadoresDoRecorte = computed(() => {
    const linha = this.filtro.linha();
    return this.dados.indicadores().filter((i) => linha === null || i.linha === linha);
  });

  private sufixoRecorte = computed(() => {
    const ano = this.filtro.ano();
    return ano === null ? 'acumulado da parceria' : `no ano de ${ano}`;
  });

  /** Identificação da parceria — fica fora do filtro, é o contrato, não o recorte. */
  readonly fatos = computed<Fato[]>(() => {
    const financeiro = this.dados.indicadores().find((i) => i.unidade === 'moeda');
    return [
      { rotulo: 'Vigência', valor: '2024–2028' },
      { rotulo: 'Linhas de ação', valor: formatQuantidade(LINHAS_ACAO.length) },
      { rotulo: 'Indicadores acompanhados', valor: formatQuantidade(this.dados.indicadores().length) },
      {
        rotulo: 'Meta de captação',
        valor: financeiro ? formatMoeda(financeiro.metaTotal) : '—',
      },
    ];
  });

  /** O número que a página lidera: cumprimento médio das metas do recorte. */
  readonly destaque = computed(() => {
    const c = cumprimento(this.indicadoresDoRecorte(), this.filtro.ano());
    return {
      pct: c.pct,
      valor: formatPercentual(c.pct),
      nota: `${c.atingidos} de ${c.total} indicadores atingidos · ${this.sufixoRecorte()}`,
    };
  });

  readonly kpis = computed<Kpi[]>(() => {
    const indicadores = this.indicadoresDoRecorte();
    const ano = this.filtro.ano();
    const lista: Kpi[] = [];

    const captacao = indicadores.find((i) => i.unidade === 'moeda');
    if (captacao) {
      const v = valoresDoRecorte(captacao, ano);
      lista.push({
        rotulo: 'Recursos captados',
        valor: formatMoeda(v.realizado),
        nota:
          ano === null
            ? `meta de ${formatMoeda(captacao.metaTotal)} até 2028`
            : `meta de ${formatMoeda(v.meta)} para ${ano}`,
      });
    }

    const nps = mediaNps(indicadores, ano);
    if (nps !== null) {
      lista.push({
        rotulo: 'NPS médio',
        valor: formatQuantidade(Math.round(nps * 10) / 10),
        nota: 'meta 80 em todas as linhas',
      });
    }

    const agentes = indicadores.find((i) => /agentes públicos/i.test(i.nome));
    if (agentes) {
      const v = valoresDoRecorte(agentes, ano);
      lista.push({
        rotulo: 'Agentes engajados',
        valor: formatQuantidade(v.realizado),
        nota: `meta de ${formatQuantidade(v.meta)} · ${this.sufixoRecorte()}`,
      });
    }

    const organizacoes = indicadores.find((i) => /^Organizações públicas/i.test(i.nome));
    if (organizacoes) {
      const v = valoresDoRecorte(organizacoes, ano);
      lista.push({
        rotulo: 'Organizações engajadas',
        valor: formatQuantidade(v.realizado),
        nota: `meta de ${formatQuantidade(v.meta)} · ${this.sufixoRecorte()}`,
      });
    }

    return lista;
  });

  /** Chamada para a página de retorno — o gancho é a alavancagem já observada. */
  readonly alavancagem = computed(() => {
    const p = this.dados.parceria();
    return p ? formatMoeda(p.alavancagem) : null;
  });
}

function mediaNps(indicadores: Indicador[], ano: number | null): number | null {
  const valores = indicadores
    .filter((i) => i.unidade === 'nps')
    .map((i) => valoresDoRecorte(i, ano).realizado)
    .filter((v) => v > 0);
  if (!valores.length) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}
