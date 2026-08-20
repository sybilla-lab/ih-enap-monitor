import { Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DataService } from '../../../core/services/data.service';
import { GlobalFilterService } from '../../../core/services/global-filter.service';
import { formatMoeda, formatPercentual, formatQuantidade } from '../../../core/util/numero.util';
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

  /** Aporte e captação do recorte em vigor: um ano específico ou o acumulado. */
  private recorte = computed(() => {
    const p = this.parceria();
    if (!p) return null;
    const ano = this.filtro.ano();
    if (ano === null) {
      return {
        ano: null,
        sufixo: 'acumulado da parceria',
        aporte: p.investimentoInicial,
        captado: p.valorCaptado,
      };
    }
    return {
      ano,
      sufixo: `em ${ano}`,
      aporte: p.aportes.find((a) => a.ano === ano)?.valor ?? 0,
      captado: this.captacao()?.anos.find((a) => a.ano === ano)?.realizado ?? 0,
    };
  });

  /** Régua do real: o aporte na proporção exata do que ele captou. */
  readonly regua = computed(() => {
    const r = this.recorte();
    const p = this.parceria();
    if (!r || !p) return null;
    const temAlavancagem = r.aporte > 0 && r.captado > 0;
    return {
      sufixo: r.sufixo,
      alavancagem: temAlavancagem ? formatMoeda(r.captado / r.aporte) : null,
      // Sem aporte no ano não existe razão a exibir; o acumulado fica de âncora.
      alternativa: temAlavancagem
        ? null
        : r.ano === null
          ? 'sem dados de aporte e captação'
          : `sem aporte registrado em ${r.ano} — no acumulado da parceria, ${formatMoeda(p.alavancagem)} por R$ 1,00`,
      investimento: formatMoeda(r.aporte),
      captado: formatMoeda(r.captado),
      // Ambas as barras na mesma escala (o maior dos dois = 100%), inclusive
      // quando o recorte não tem nenhum dos dois: aí as duas ficam em zero.
      larguraInvestimento: escala(r.aporte, r.captado),
      larguraCaptado: escala(r.captado, r.aporte),
    };
  });

  readonly numeros = computed(() => {
    const r = this.recorte();
    const p = this.parceria();
    if (!r || !p) return [];
    const temAporte = r.aporte > 0;
    return [
      {
        rotulo: 'Aporte da Enap',
        valor: formatMoeda(r.aporte),
        nota: r.ano === null ? `${p.aportes.filter((a) => a.valor > 0).length} anos de aporte` : r.sufixo,
      },
      {
        rotulo: 'Captado de fontes externas',
        valor: formatMoeda(r.captado),
        nota: `públicas, privadas e internacionais · ${r.sufixo}`,
      },
      {
        rotulo: 'Retorno líquido',
        valor: formatMoeda(r.captado - r.aporte),
        nota: 'captado menos aporte',
      },
      {
        rotulo: 'ROI',
        valor: temAporte ? formatPercentual(((r.captado - r.aporte) / r.aporte) * 100) : '—',
        nota: temAporte ? `retorno líquido sobre o aporte · ${r.sufixo}` : 'exige aporte no recorte',
      },
    ];
  });

  readonly aportes = computed(() =>
    (this.parceria()?.aportes ?? [])
      .filter((a) => a.valor > 0)
      .map((a) => ({
        ano: a.ano,
        valor: formatMoeda(a.valor),
        foraDoRecorte: this.filtro.ano() !== null && this.filtro.ano() !== a.ano,
      })),
  );

  readonly captacaoPorAno = computed<AnoCaptacao[]>(() => {
    const ind = this.captacao();
    if (!ind) return [];
    const anos = ind.anos.filter((a) => a.meta > 0 || a.realizado > 0);
    const maior = Math.max(...anos.map((a) => Math.max(a.meta, a.realizado)), 1);
    const anoCorrente = new Date().getFullYear();
    const selecionado = this.filtro.ano();
    return anos.map((a) => ({
      ano: a.ano,
      metaLabel: formatMoeda(a.meta),
      realizadoLabel: formatMoeda(a.realizado),
      larguraMeta: (a.meta / maior) * 100,
      larguraRealizado: (a.realizado / maior) * 100,
      emCurso: a.ano === anoCorrente,
      foraDoRecorte: selecionado !== null && selecionado !== a.ano,
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
