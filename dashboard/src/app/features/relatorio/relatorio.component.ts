import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DataService } from '../../core/services/data.service';
import { GlobalFilterService } from '../../core/services/global-filter.service';
import { TerritorioService } from '../../core/services/territorio.service';
import { LINHAS_ACAO, LinhaAcaoId } from '../../core/models/indicadores.model';
import { UF_GRID } from '../../core/models/territorio.model';
import {
  avancoRumoAMetaFinal,
  cumprimento,
  ehCumulativo,
  valoresDoRecorte,
} from '../../core/util/agregacao.util';
import { formatMoeda, formatPercentual, formatQuantidade } from '../../core/util/numero.util';
import { kpisDaParceria } from '../../core/util/kpis.util';
import { retornoDoRecorte } from '../../core/util/retorno.util';
import { escalaComum, graficoAvanco, svgDoMapa, tilesDoMapa } from './grafico-svg';
import { ModeloRelatorio, baixarRelatorio } from './relatorio-pdf';

/**
 * Relatório executivo em documento: uma peça pensada para virar PDF pelo
 * "imprimir" do navegador, não uma tela capturada.
 *
 * Por que assim: o texto sai vetorial e selecionável, as tabelas quebram entre
 * páginas com o cabeçalho repetido, e o documento herda os mesmos tokens de cor
 * e tipografia da aplicação — o relatório se parece com o painel porque é feito
 * do mesmo material, não porque é uma foto dele.
 *
 * O relatório respeita o recorte do filtro global: a capa declara qual é, e
 * cada seção mostra os números daquele recorte.
 */
@Component({
  selector: 'app-relatorio',
  standalone: true,
  imports: [MatIconModule, DatePipe],
  templateUrl: './relatorio.component.html',
  styleUrl: './relatorio.component.scss',
})
export class RelatorioComponent {
  private dados = inject(DataService);
  private filtro = inject(GlobalFilterService);
  private territorioSrv = inject(TerritorioService);

  readonly moeda = formatMoeda;
  readonly quantidade = formatQuantidade;
  readonly percentual = formatPercentual;

  readonly origem = this.dados.origem;
  readonly territorio = this.territorioSrv.dados;

  readonly emitidoEm = new Date();

  readonly recorte = computed(() => {
    const anos = this.filtro.recorte();
    return anos === null
      ? 'Acumulado da parceria (2024–2028)'
      : `${anos.length === 1 ? 'Ano de' : 'Anos de'} ${anos.join(', ')}`;
  });

  private indicadoresDoRecorte = this.dados.indicadores;

  // ------------------------------------------------------------ panorama ----

  readonly panorama = computed(() => {
    const c = cumprimento(this.indicadoresDoRecorte(), this.filtro.recorte());
    return { pct: c.pct, valor: formatPercentual(c.pct), total: c.total, atingidos: c.atingidos };
  });

  /** Os mesmos dez KPIs da Home — uma lista só para as duas saídas. */
  readonly numerosChave = computed(() =>
    kpisDaParceria(
      this.dados.indicadores(),
      this.dados.entregas(),
      this.dados.parceria(),
      this.filtro.recorte(),
      this.filtro.rotulo(),
    ),
  );

  /** Tabela completa de indicadores — o miolo verificável do relatório. */
  readonly tabelaIndicadores = computed(() => {
    const ano = this.filtro.recorte();
    return this.indicadoresDoRecorte().map((ind) => {
      const v = valoresDoRecorte(ind, ano);
      const pct = v.meta > 0 ? Math.min((v.realizado / v.meta) * 100, 999) : null;
      const formatar = (valor: number) =>
        ind.unidade === 'moeda'
          ? formatMoeda(valor)
          : ind.unidade === 'percentual'
            ? formatPercentual(valor * (valor <= 1 ? 100 : 1))
            : formatQuantidade(valor);
      return {
        linha: ind.linha,
        nome: ind.nome,
        meta: v.meta > 0 ? formatar(v.meta) : '—',
        realizado: formatar(v.realizado),
        pct,
        pctLabel: pct === null ? '—' : formatPercentual(Math.min(pct, 100)),
        barra: pct === null ? 0 : Math.min(pct, 100),
        atingido: pct !== null && pct >= 100,
      };
    });
  });

  readonly progressoPorLinha = computed(() => {
    const indicadores = this.dados.indicadores();
    const ano = this.filtro.recorte();
    return LINHAS_ACAO.map((linha) => {
      const c = cumprimento(
        indicadores.filter((i) => i.linha === linha.id),
        ano,
      );
      return {
        rotulo: `${linha.id} · ${linha.nome}`,
        detalhe: `${c.total} indicadores · ${c.atingidos} atingidos`,
        valor: formatPercentual(c.pct),
        preenchimento: c.pct,
        total: c.total,
      };
    }).filter((l) => l.total > 0);
  });

  // -------------------------------------------------------------- avanço ----

  readonly pontosAvanco = computed(() => avancoRumoAMetaFinal(this.indicadoresDoRecorte()));
  readonly grafico = computed(() => graficoAvanco(this.pontosAvanco()));
  readonly totalCumulativos = computed(
    () => this.indicadoresDoRecorte().filter(ehCumulativo).length,
  );

  readonly leituraAvanco = computed(() => {
    const comDados = this.pontosAvanco().filter((p) => p.realizado !== null);
    const ultimo = comDados[comDados.length - 1];
    if (!ultimo || ultimo.realizado === null) return null;
    return {
      ano: ultimo.ano,
      entregue: formatPercentual(ultimo.realizado),
      plano: formatPercentual(ultimo.plano),
      parcial: ultimo.parcial,
      atrasado: ultimo.realizado < ultimo.plano,
    };
  });

  // ------------------------------------------------------------- retorno ----

  readonly parceria = computed(() => this.dados.parceria());
  private captacao = computed(() => this.dados.indicadores().find((i) => i.unidade === 'moeda'));

  readonly retorno = computed(() => {
    const r = retornoDoRecorte(this.parceria(), this.captacao(), this.filtro.recorte());
    if (!r) return null;
    const maior = Math.max(r.aporte, r.captado);
    return {
      aporte: formatMoeda(r.aporte),
      captado: formatMoeda(r.captado),
      liquido: formatMoeda(r.liquido),
      roi: r.roiPercentual === null ? '—' : formatPercentual(r.roiPercentual),
      alavancagem: r.alavancagem === null ? null : formatMoeda(r.alavancagem),
      larguraAporte: maior > 0 ? (r.aporte / maior) * 100 : 0,
      larguraCaptado: maior > 0 ? (r.captado / maior) * 100 : 0,
      anosDeAporte: r.anosDeAporte,
    };
  });

  readonly captacaoPorAno = computed(() => {
    const ind = this.captacao();
    const p = this.parceria();
    if (!ind) return [];
    const anos = ind.anos.filter((a) => a.meta > 0 || a.realizado > 0);
    const escala = escalaComum(anos.flatMap((a) => [a.meta, a.realizado]));
    const anoCorrente = new Date().getFullYear();
    return anos.map((a) => ({
      ano: a.ano,
      meta: formatMoeda(a.meta),
      realizado: formatMoeda(a.realizado),
      aporte: formatMoeda(p?.aportes.find((x) => x.ano === a.ano)?.valor ?? 0),
      preenchimento: escala(a.realizado),
      referencia: escala(a.meta),
      emCurso: a.ano === anoCorrente,
    }));
  });

  /** Projeções para o relatório: o simulador da tela vira três cenários fixos. */
  readonly projecoes = computed(() => {
    const p = this.parceria();
    const ind = this.captacao();
    if (!p || !ind) return null;
    const fatores = p.aportes
      .filter((a) => a.valor > 0)
      .map((a) => (ind.anos.find((x) => x.ano === a.ano)?.realizado ?? 0) / a.valor)
      .filter((f) => f > 0);
    if (!fatores.length) return null;

    const min = Math.min(...fatores);
    const max = Math.max(...fatores);
    const fator = (v: number) => v.toFixed(1).replace('.', ',');
    return {
      faixa: `${fator(min)}× a ${fator(max)}×`,
      acumulada: formatMoeda(p.alavancagem),
      cenarios: [500_000, 1_000_000, 2_000_000].map((aporte) => ({
        aporte: formatMoeda(aporte),
        central: formatMoeda(aporte * p.alavancagem),
        minimo: formatMoeda(aporte * min),
        maximo: formatMoeda(aporte * max),
      })),
    };
  });

  readonly escalaDesafios = computed(() => {
    const e = this.parceria()?.escalaDesafios;
    if (!e) return null;
    return {
      meta: e.meta,
      projecao: e.projecao,
      nota: e.nota,
      multiplo: formatQuantidade(Math.round((e.projecao / e.meta) * 10) / 10),
      pontos: Array.from({ length: e.projecao }, (_, i) => i < e.meta),
    };
  });

  // ----------------------------------------------------------- território ----

  readonly mapa = computed(() => {
    const t = this.territorio();
    if (!t) return null;
    return tilesDoMapa(UF_GRID, t.alcancePorUf);
  });

  private nomeUf = new Map(UF_GRID.map((u) => [u.sigla, u.nome]));

  /** Uma linha por estado alcançado, com as iniciativas nomeadas. */
  readonly estados = computed(() => {
    const t = this.territorio();
    if (!t) return [];
    return Object.entries(t.alcancePorUf)
      .map(([uf, frentes]) => {
        const iniciativas = [
          ...new Set(t.registros.alcance.filter((r) => r.uf === uf).map((r) => r.iniciativa)),
        ];
        const prefeituras = t.rankingOrgsPorAgentes.filter((o) => o.uf === uf).map((o) => o.nome);
        return {
          uf,
          nome: this.nomeUf.get(uf) ?? uf,
          frentes,
          iniciativas: [...iniciativas, ...prefeituras].join(' · ') || '—',
        };
      })
      .sort((a, b) => b.frentes - a.frentes || a.uf.localeCompare(b.uf));
  });

  readonly ranking = computed(() => {
    const t = this.territorio();
    if (!t) return [];
    const escala = escalaComum(t.rankingOrgsPorAgentes.map((o) => o.agentes));
    return t.rankingOrgsPorAgentes.map((o) => ({
      nome: o.nome,
      agentes: o.agentes,
      uf: o.uf,
      preenchimento: escala(o.agentes),
    }));
  });

  readonly niveis = computed(() =>
    Object.entries(this.territorio()?.organizacoesPorNivel ?? {}).map(([nivel, total]) => ({
      nivel,
      total,
    })),
  );

  linhaCurta(id: LinhaAcaoId): string {
    return id.replace('Linha ', '');
  }

  imprimir(): void {
    window.print();
  }

  readonly baixando = signal(false);
  readonly erroPdf = signal<string | null>(null);

  /** Um clique, um arquivo: sem diálogo de impressão e com nome pronto. */
  async baixarPdf(): Promise<void> {
    this.baixando.set(true);
    this.erroPdf.set(null);
    try {
      await baixarRelatorio(this.modeloParaPdf());
    } catch (err) {
      console.error('Erro ao gerar o PDF:', err);
      this.erroPdf.set('Não foi possível gerar o PDF. Use "Imprimir" como alternativa.');
    } finally {
      this.baixando.set(false);
    }
  }

  /** O documento em dados — a mesma informação que a página mostra. */
  private modeloParaPdf(): ModeloRelatorio {
    const t = this.territorio();
    const mapa = this.mapa();
    const escala = this.escalaDesafios();
    const leitura = this.leituraAvanco();

    return {
      recorte: this.recorte(),
      emitidoEm: this.emitidoEm,
      arquivo: this.origem()?.arquivo ?? 'Planilha Oficial de Indicadores',
      panorama: this.panorama(),
      numerosChave: this.numerosChave(),
      progressoPorLinha: this.progressoPorLinha(),
      indicadores: this.tabelaIndicadores().map((i) => ({
        linha: this.linhaCurta(i.linha),
        nome: i.nome,
        meta: i.meta,
        realizado: i.realizado,
        pctLabel: i.pctLabel,
        barra: i.barra,
        atingido: i.atingido,
      })),
      grafico: this.grafico(),
      avanco: this.pontosAvanco().map((p) => ({
        ano: p.ano,
        realizado: p.realizado === null ? '—' : formatPercentual(p.realizado),
        plano: formatPercentual(p.plano),
        parcial: p.parcial,
      })),
      leituraAvanco: leitura
        ? `Até ${leitura.ano}, ${leitura.entregue} da meta de 2028 estava entregue. O cronograma ${leitura.parcial ? 'prevê' : 'previa'} ${leitura.plano} ${leitura.parcial ? 'até o fim do ano' : 'nesse ponto'}.`
        : null,
      notaAvanco: `Média de ${this.totalCumulativos()} indicadores cumulativos (contagens e valores em R$), cada um normalizado pela própria meta total. NPS e percentuais de execução ficam fora desta leitura: são medidas do período e não se acumulam.`,
      retorno: this.retorno(),
      captacaoPorAno: this.captacaoPorAno().map((a) => ({
        ano: `${a.ano}${a.emCurso ? ' (em curso)' : ''}`,
        aporte: a.aporte,
        meta: a.meta,
        realizado: a.realizado,
        preenchimento: a.preenchimento,
        referencia: a.referencia,
      })),
      projecoes: this.projecoes(),
      escala: escala
        ? { meta: escala.meta, projecao: escala.projecao, multiplo: escala.multiplo, nota: escala.nota }
        : null,
      territorio:
        t && mapa && !t.vazio
          ? {
              ufsAlcancadas: t.ufsAlcancadas,
              totalUfs: t.totalUfs,
              organizacoes: t.organizacoesPublicas,
              niveis: this.niveis()
                .map((n) => `${n.total} ${n.nivel.toLowerCase()}`)
                .join(' · '),
              agentes: t.totalAgentes,
              instituicoes: t.rankingOrgsPorAgentes.length,
              municipios: t.municipios.map((mu) => `${mu.cidade}/${mu.uf}`).join(' · '),
              totalMunicipios: t.municipios.length,
              mapaSvg: svgDoMapa(mapa, { acento: '#a23b4a', fio: '#d9d1cf', tinta: '#17120f' }),
              estados: this.estados(),
              ranking: this.ranking(),
            }
          : null,
      notas: NOTAS_METODOLOGICAS,
    };
  }
}

/** Mesmo texto da seção 05 da página — a fonte única das duas saídas. */
const NOTAS_METODOLOGICAS = [
  {
    titulo: 'Cumprimento médio',
    texto:
      'As unidades dos indicadores não são somáveis entre si (contagens, R$, % e NPS). Cada indicador é normalizado pela própria meta, capado em 100%, e o painel exibe a média.',
  },
  {
    titulo: 'Avanço rumo a 2028',
    texto:
      'Realizado acumulado dividido pela meta total da parceria, ano a ano — por isso a curva só cresce. Uma taxa de cumprimento por período, ao contrário, cai quando o ano corrente entra com a meta cheia e o realizado parcial.',
  },
  {
    titulo: 'Ano em curso',
    texto:
      'O último ponto com dados é parcial: a meta do ano já conta inteira, mas o realizado vai até a data de emissão deste relatório.',
  },
  {
    titulo: 'Frentes por estado',
    texto:
      'Somam as iniciativas que alcançaram o estado e as prefeituras com agentes públicos engajados. Registros sem data na origem não entram em recortes por ano.',
  },
  {
    titulo: 'Retorno e alavancagem',
    texto:
      'Aporte é a soma das entradas anuais da Enap; a alavancagem é a captação dividida pelo aporte no recorte. Os textos narrativos da planilha não são usados como fonte.',
  },
];
