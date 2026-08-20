import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '../../core/services/data.service';
import { GlobalFilterService } from '../../core/services/global-filter.service';
import {
  ANOS_PARCERIA,
  Indicador,
  LINHAS_ACAO,
  LinhaAcao,
} from '../../core/models/indicadores.model';
import { cumprimento, valoresDoRecorte } from '../../core/util/agregacao.util';
import { formatMoeda, formatPercentual, formatQuantidade } from '../../core/util/numero.util';
import { RetornoBlocosComponent } from './components/retorno-blocos.component';

/** Descrição de cada linha — o que a página promete além dos números. */
const RESUMOS: Record<string, string> = {
  'Linha I':
    'Desafios de inovação aberta — customizados, de grande impacto e em autosserviço na Plataforma Desafios — e o engajamento de agentes públicos nesses projetos.',
  'Linha II':
    'Ciclos de aceleração, ideação e incubação de soluções, com a avaliação de quem participa.',
  'Linha III':
    'Ambientes de inovação, atividades de conexão, projetos de cocriação, conteúdo e a presença na Semana de Inovação.',
  'Linha IV':
    'Captação de recursos fora do orçamento da União, organizações públicas engajadas e o retorno financeiro da parceria.',
};

interface CelulaAno {
  ano: number;
  meta: string;
  realizado: string;
  pct: number | null;
  pctLabel: string;
  atingido: boolean;
  emCurso: boolean;
  vazio: boolean;
}

interface IndicadorDaLinha {
  nome: string;
  unidade: string;
  totalMeta: string;
  totalRealizado: string;
  pct: number;
  pctLabel: string;
  atingido: boolean;
  anos: CelulaAno[];
}

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
  imports: [MatProgressBarModule, RetornoBlocosComponent],
  templateUrl: './linha.component.html',
  styleUrl: './linha.component.scss',
})
export class LinhaComponent {
  readonly dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);
  private rota = inject(ActivatedRoute);

  readonly anos = ANOS_PARCERIA;
  private anoCorrente = new Date().getFullYear();

  readonly linha = toSignal(
    this.rota.data.pipe(map((d) => (d['linha'] as LinhaAcao | undefined) ?? LINHAS_ACAO[0])),
    { initialValue: LINHAS_ACAO[0] },
  );

  readonly resumo = computed(() => RESUMOS[this.linha().id] ?? '');

  private indicadoresDaLinha = computed(() =>
    this.dados.indicadores().filter((i) => i.linha === this.linha().id),
  );

  readonly panorama = computed(() => {
    const c = cumprimento(this.indicadoresDaLinha(), this.filtro.ano());
    return {
      valor: formatPercentual(c.pct),
      pct: c.pct,
      nota: `${c.atingidos} de ${c.total} indicadores atingidos · ${this.filtro.rotulo()}`,
    };
  });

  readonly indicadores = computed<IndicadorDaLinha[]>(() =>
    this.indicadoresDaLinha().map((ind) => {
      const formatar = formatador(ind);
      const razao = ind.metaTotal > 0 ? ind.realizadoTotal / ind.metaTotal : null;
      return {
        nome: ind.nome,
        unidade: rotuloUnidade(ind),
        totalMeta: ind.metaTotal > 0 ? formatar(ind.metaTotal) : '—',
        totalRealizado: formatar(ind.realizadoTotal),
        pct: razao === null ? 0 : Math.min(razao * 100, 100),
        pctLabel: razao === null ? '—' : formatPercentual(Math.min(razao * 100, 100)),
        atingido: razao !== null && razao >= 1,
        anos: ANOS_PARCERIA.map((ano) => {
          const v = valoresDoRecorte(ind, ano);
          const r = v.meta > 0 ? v.realizado / v.meta : null;
          return {
            ano,
            meta: v.meta > 0 ? formatar(v.meta) : '—',
            realizado: v.meta > 0 || v.realizado > 0 ? formatar(v.realizado) : '—',
            pct: r === null ? null : Math.min(r * 100, 100),
            pctLabel: r === null ? '—' : formatPercentual(Math.min(r * 100, 100)),
            atingido: r !== null && r >= 1,
            emCurso: ano === this.anoCorrente,
            vazio: v.meta === 0 && v.realizado === 0,
          };
        }),
      };
    }),
  );

  /** A Linha IV carrega também a leitura financeira da parceria. */
  readonly mostrarRetorno = computed(() => this.linha().id === 'Linha IV');
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
