import { Component, computed, inject } from '@angular/core';
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
import { escalaComum, graficoAvanco, tilesDoMapa } from './grafico-svg';

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
    const ano = this.filtro.ano();
    const linha = this.filtro.linha();
    const partes = [ano === null ? 'Acumulado da parceria (2024–2028)' : `Ano de ${ano}`];
    if (linha) partes.push(`${linha} — ${LINHAS_ACAO.find((l) => l.id === linha)?.nome}`);
    return partes.join(' · ');
  });

  private indicadoresDoRecorte = computed(() => {
    const linha = this.filtro.linha();
    return this.dados.indicadores().filter((i) => linha === null || i.linha === linha);
  });

  // ------------------------------------------------------------ panorama ----

  readonly panorama = computed(() => {
    const c = cumprimento(this.indicadoresDoRecorte(), this.filtro.ano());
    return { pct: c.pct, valor: formatPercentual(c.pct), total: c.total, atingidos: c.atingidos };
  });

  readonly numerosChave = computed(() => {
    const indicadores = this.indicadoresDoRecorte();
    const ano = this.filtro.ano();
    const lista: { rotulo: string; valor: string; nota: string }[] = [];

    const captacao = indicadores.find((i) => i.unidade === 'moeda');
    if (captacao) {
      const v = valoresDoRecorte(captacao, ano);
      lista.push({
        rotulo: 'Recursos captados',
        valor: formatMoeda(v.realizado),
        nota: `meta de ${formatMoeda(v.meta || captacao.metaTotal)}`,
      });
    }

    const nps = indicadores.filter((i) => i.unidade === 'nps');
    const medias = nps.map((i) => valoresDoRecorte(i, ano).realizado).filter((v) => v > 0);
    if (medias.length) {
      lista.push({
        rotulo: 'NPS médio',
        valor: formatQuantidade(Math.round((medias.reduce((s, v) => s + v, 0) / medias.length) * 10) / 10),
        nota: `média de ${medias.length} indicadores · meta 80`,
      });
    }

    const t = this.territorio();
    if (t) {
      lista.push({
        rotulo: 'Agentes públicos engajados',
        valor: formatQuantidade(t.totalAgentes),
        nota: `em ${t.rankingOrgsPorAgentes.length} organizações`,
      });
      lista.push({
        rotulo: 'Estados alcançados',
        valor: `${t.ufsAlcancadas} de ${t.totalUfs}`,
        nota: `${t.organizacoesPublicas} organizações públicas engajadas`,
      });
    }
    return lista;
  });

  /** Tabela completa de indicadores — o miolo verificável do relatório. */
  readonly tabelaIndicadores = computed(() => {
    const ano = this.filtro.ano();
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
    const ano = this.filtro.ano();
    const linhaFiltrada = this.filtro.linha();
    return LINHAS_ACAO.filter((l) => linhaFiltrada === null || l.id === linhaFiltrada)
      .map((linha) => {
        const c = cumprimento(
          indicadores.filter((i) => i.linha === linha.id),
          ano,
        );
        return {
          rotulo: `${linha.id} · ${linha.nome}`,
          detalhe: `${c.total} indicadores · ${c.atingidos} atingidos`,
          valor: formatPercentual(c.pct),
          preenchimento: c.pct,
        };
      })
      .filter((l) => l.detalhe !== '0 indicadores · 0 atingidos');
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
    const p = this.parceria();
    if (!p) return null;
    const ano = this.filtro.ano();
    const aporte = ano === null ? p.investimentoInicial : (p.aportes.find((a) => a.ano === ano)?.valor ?? 0);
    const captado =
      ano === null ? p.valorCaptado : (this.captacao()?.anos.find((a) => a.ano === ano)?.realizado ?? 0);
    const maior = Math.max(aporte, captado);
    return {
      aporte: formatMoeda(aporte),
      captado: formatMoeda(captado),
      liquido: formatMoeda(captado - aporte),
      roi: aporte > 0 ? formatPercentual(((captado - aporte) / aporte) * 100) : '—',
      alavancagem: aporte > 0 && captado > 0 ? formatMoeda(captado / aporte) : null,
      larguraAporte: maior > 0 ? (aporte / maior) * 100 : 0,
      larguraCaptado: maior > 0 ? (captado / maior) * 100 : 0,
      anosDeAporte: p.aportes.filter((a) => a.valor > 0).length,
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
}
