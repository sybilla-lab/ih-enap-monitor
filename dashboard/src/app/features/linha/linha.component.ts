import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '../../core/services/data.service';
import { GlobalFilterService } from '../../core/services/global-filter.service';
import {
  Indicador,
  LINHAS_ACAO,
  LinhaAcao,
  anosVisiveis,
  ehPlanoComplementar,
} from '../../core/models/indicadores.model';
import { cumprimento, valoresDoRecorte } from '../../core/util/agregacao.util';
import { formatMoeda, formatPercentual, formatQuantidade } from '../../core/util/numero.util';
import { RetornoBlocosComponent } from './components/retorno-blocos.component';
import { EventosLinhaIiiComponent } from './components/eventos-linha-iii.component';
import {
  IndicadorApresentado,
  IndicadorCardComponent,
} from './components/indicador-card.component';

/**
 * Página de uma linha de ação, servida para as quatro rotas — a linha vem de
 * `data.linha` na rota. As quatro páginas são a mesma leitura com dados
 * diferentes; duplicar o componente só multiplicaria manutenção.
 *
 * Cada indicador aparece com o acumulado e com todos os anos lado a lado, e não
 * só com o ano filtrado: a pactuação é plurianual e o cliente precisa ver a
 * série inteira. O filtro de ano destaca a coluna correspondente.
 */
@Component({
  selector: 'app-linha',
  standalone: true,
  imports: [
    MatProgressBarModule,
    RetornoBlocosComponent,
    IndicadorCardComponent,
    EventosLinhaIiiComponent,
  ],
  templateUrl: './linha.component.html',
  styleUrl: './linha.component.scss',
})
export class LinhaComponent {
  readonly dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);
  private rota = inject(ActivatedRoute);

  private anoCorrente = new Date().getFullYear();

  readonly linha = toSignal(
    this.rota.data.pipe(map((d) => (d['linha'] as LinhaAcao | undefined) ?? LINHAS_ACAO[0])),
    { initialValue: LINHAS_ACAO[0] },
  );

  /** Texto oficial da linha, definido com o cliente (revisão 02). */
  readonly resumo = computed(() => this.linha().descricao);

  /** Anos exibidos na série: os que já começaram, mais os do filtro. */
  readonly anosDaSerie = computed(() => anosVisiveis(this.filtro.recorte()));

  private indicadoresDaLinha = computed(() =>
    this.dados.indicadores().filter((i) => i.linha === this.linha().id),
  );

  readonly panorama = computed(() => {
    const c = cumprimento(this.indicadoresDaLinha(), this.filtro.recorte());
    return {
      valor: formatPercentual(c.pct),
      pct: c.pct,
      nota: `${c.atingidos} de ${c.total} indicadores atingidos · ${this.filtro.rotulo()}`,
    };
  });

  readonly indicadores = computed<IndicadorApresentado[]>(() => {
    const anoSelecionado = this.filtro.recorte();
    const anosDaSerie = this.anosDaSerie();
    return this.indicadoresDaLinha().map((ind) => {
      const formatar = formatador(ind);
      const razao = ind.metaTotal > 0 ? ind.realizadoTotal / ind.metaTotal : null;
      // Escala das colunas: o maior valor do indicador no período vale a altura
      // cheia, para as barras de um mesmo indicador serem comparáveis entre si.
      const maior = Math.max(
        ...ind.anos.filter((a) => anosDaSerie.includes(a.ano)).flatMap((a) => [a.meta, a.realizado]),
        1,
      );

      return {
        nome: ind.nome,
        unidade: rotuloUnidade(ind),
        largo: ind.unidade === 'moeda',
        totalMeta: ind.metaTotal > 0 ? formatar(ind.metaTotal) : '—',
        totalRealizado: formatar(ind.realizadoTotal),
        pct: razao === null ? 0 : Math.min(razao * 100, 100),
        pctLabel: razao === null ? '—' : formatPercentual(Math.min(razao * 100, 100)),
        atingido: razao !== null && razao >= 1,
        planoComplementar: ehPlanoComplementar(ind.nome),
        anos: anosDaSerie.map((ano) => {
          // Cada coluna é sempre o ano dela, independente do filtro — o recorte
          // muda o destaque, não o que a série mostra.
          const v = valoresDoRecorte(ind, [ano]);
          const r = v.meta > 0 ? v.realizado / v.meta : null;
          const vazio = v.meta === 0 && v.realizado === 0;
          return {
            ano,
            meta: v.meta > 0 ? formatar(v.meta) : '—',
            metaRotulo: v.meta > 0 ? `meta ${formatar(v.meta)}` : 'sem meta',
            realizado: vazio ? '—' : formatar(v.realizado),
            alturaMeta: (v.meta / maior) * 100,
            alturaRealizado: (v.realizado / maior) * 100,
            pctLabel: r === null ? '—' : formatPercentual(Math.min(r * 100, 100)),
            atingido: r !== null && r >= 1,
            emCurso: ano === this.anoCorrente,
            vazio,
            selecionado: anoSelecionado?.includes(ano) ?? false,
          };
        }),
      };
    });
  });

  /** A Linha IV carrega também a leitura financeira da parceria. */
  readonly mostrarRetorno = computed(() => this.linha().id === 'Linha IV');

  /** A Linha III carrega o bloco de eventos (revisão 04). */
  readonly mostrarEventos = computed(() => this.linha().id === 'Linha III');
}

/** Formatação por unidade — a mesma regra usada no resto do painel. */
function formatador(ind: Indicador): (v: number) => string {
  if (ind.unidade === 'moeda') return formatMoeda;
  if (ind.unidade === 'percentual') return (v) => formatPercentual(v <= 1 ? v * 100 : v);
  return formatQuantidade;
}

function rotuloUnidade(ind: Indicador): string {
  switch (ind.unidade) {
    case 'moeda':
      return 'R$';
    case 'percentual':
      return '%';
    case 'nps':
      return 'NPS';
    default:
      return 'quantidade';
  }
}
