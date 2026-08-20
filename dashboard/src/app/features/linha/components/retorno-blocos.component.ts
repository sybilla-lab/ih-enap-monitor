import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DataService } from '../../../core/services/data.service';
import { GlobalFilterService } from '../../../core/services/global-filter.service';
import { formatMoeda, formatPercentual, formatQuantidade } from '../../../core/util/numero.util';
import { retornoDoRecorte } from '../../../core/util/retorno.util';
import { SimuladorAlavancagemComponent } from './simulador-alavancagem.component';

/** Largura de `valor` numa escala em que o maior dos dois vale 100%. */
function escala(valor: number, outro: number): number {
  const maior = Math.max(valor, outro);
  return maior > 0 ? (valor / maior) * 100 : 0;
}

interface AnoCaptacao {
  ano: number;
  metaLabel: string;
  realizadoLabel: string;
  /** Largura relativa ao maior valor do período — comparação visual honesta. */
  larguraMeta: number;
  larguraRealizado: number;
  emCurso: boolean;
  foraDoRecorte: boolean;
}

/**
 * Retorno da parceria: o que a Enap aportou, o que a parceria captou fora do
 * orçamento da União e quanto isso representa por real investido.
 *
 * Vive dentro da página da Linha IV — prospecção e retorno são a mesma leitura
 * para o cliente, e separá-los em duas páginas obrigava a ir e voltar.
 *
 * Responde ao filtro de ano: sem recorte os números são o acumulado da
 * parceria; com um ano selecionado, são o aporte e a captação daquele ano. Anos
 * sem aporte registrado não têm alavancagem — a página diz isso em vez de
 * exibir um número inventado.
 *
 * Tudo sai de dois lugares da planilha oficial: a aba Parceria (aportes anuais,
 * valor captado, ROI) e o indicador financeiro da aba Metas (meta e realizado de
 * captação por ano). Nada é estimativa, exceto o simulador — rotulado como
 * projeção e alimentado só por alavancagem já observada.
 */
@Component({
  selector: 'app-retorno-blocos',
  standalone: true,
  imports: [MatIconModule, SimuladorAlavancagemComponent],
  templateUrl: './retorno-blocos.component.html',
  styleUrl: './retorno-blocos.component.scss',
})
export class RetornoBlocosComponent {
  readonly dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);

  readonly moeda = formatMoeda;
  readonly quantidade = formatQuantidade;

  readonly parceria = computed(() => this.dados.parceria());

  private captacao = computed(() => this.dados.indicadores().find((i) => i.unidade === 'moeda'));

  /** Aporte e captação do recorte em vigor — a mesma conta que a Home usa. */
  private retorno = computed(() =>
    retornoDoRecorte(this.parceria(), this.captacao(), this.filtro.recorte()),
  );

  /** Régua do real: o aporte na proporção exata do que ele captou. */
  readonly regua = computed(() => {
    const r = this.retorno();
    const p = this.parceria();
    if (!r || !p) return null;
    return {
      sufixo: this.filtro.rotulo(),
      alavancagem: r.alavancagem === null ? null : formatMoeda(r.alavancagem),
      // Sem aporte no recorte não existe razão a exibir; o acumulado fica de âncora.
      alternativa:
        r.alavancagem !== null
          ? null
          : this.filtro.recorte() === null
            ? 'sem dados de aporte e captação'
            : `sem aporte registrado no recorte — no acumulado da parceria, ${formatMoeda(p.alavancagem)} por R$ 1,00`,
      investimento: formatMoeda(r.aporte),
      captado: formatMoeda(r.captado),
      // Ambas as barras na mesma escala (o maior dos dois = 100%), inclusive
      // quando o recorte não tem nenhum dos dois: aí as duas ficam em zero.
      larguraInvestimento: escala(r.aporte, r.captado),
      larguraCaptado: escala(r.captado, r.aporte),
    };
  });

  readonly numeros = computed(() => {
    const r = this.retorno();
    if (!r) return [];
    const sufixo = this.filtro.rotulo();
    return [
      {
        rotulo: 'Aporte da Enap',
        valor: formatMoeda(r.aporte),
        nota:
          this.filtro.recorte() === null ? `${r.anosDeAporte} anos de aporte` : sufixo,
      },
      {
        rotulo: 'Captado de fontes externas',
        valor: formatMoeda(r.captado),
        nota: `públicas, privadas e internacionais · ${sufixo}`,
      },
      {
        rotulo: 'Retorno líquido',
        valor: formatMoeda(r.liquido),
        nota: 'captado menos aporte',
      },
      {
        rotulo: 'ROI',
        valor: r.roiPercentual === null ? '—' : formatPercentual(r.roiPercentual),
        nota:
          r.roiPercentual === null
            ? 'exige aporte no recorte'
            : `retorno líquido sobre o aporte · ${sufixo}`,
      },
    ];
  });

  readonly aportes = computed(() =>
    (this.parceria()?.aportes ?? [])
      .filter((a) => a.valor > 0)
      .map((a) => ({
        ano: a.ano,
        valor: formatMoeda(a.valor),
        foraDoRecorte: !(this.filtro.recorte()?.includes(a.ano) ?? true),
      })),
  );

  readonly captacaoPorAno = computed<AnoCaptacao[]>(() => {
    const ind = this.captacao();
    if (!ind) return [];
    const anos = ind.anos.filter((a) => a.meta > 0 || a.realizado > 0);
    const maior = Math.max(...anos.map((a) => Math.max(a.meta, a.realizado)), 1);
    const anoCorrente = new Date().getFullYear();
    const selecionado = this.filtro.recorte();
    return anos.map((a) => ({
      ano: a.ano,
      metaLabel: formatMoeda(a.meta),
      realizadoLabel: formatMoeda(a.realizado),
      larguraMeta: (a.meta / maior) * 100,
      larguraRealizado: (a.realizado / maior) * 100,
      emCurso: a.ano === anoCorrente,
      foraDoRecorte: !(selecionado?.includes(a.ano) ?? true),
    }));
  });

  /**
   * Alavancagem observada ano a ano (captação do ano ÷ aporte do ano). Serve de
   * faixa para o simulador: o acumulado é a média, mas os anos isolados vão de
   * ~4,5× a ~16,5× — a projeção precisa mostrar essa variação.
   */
  private alavancagemPorAno = computed(() => {
    const p = this.parceria();
    const ind = this.captacao();
    if (!p || !ind) return [];
    return p.aportes
      .filter((a) => a.valor > 0)
      .map((a) => (ind.anos.find((x) => x.ano === a.ano)?.realizado ?? 0) / a.valor)
      .filter((fator) => fator > 0);
  });

  readonly faixaAlavancagem = computed(() => {
    const fatores = this.alavancagemPorAno();
    if (!fatores.length) return null;
    return { min: Math.min(...fatores), max: Math.max(...fatores) };
  });

  /** Meta contratada × alcance projetado de desafios, em pontos. */
  readonly escala = computed(() => {
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
}
