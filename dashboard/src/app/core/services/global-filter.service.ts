import { Injectable, computed, signal } from '@angular/core';
import { ANOS_PARCERIA } from '../models/indicadores.model';

/**
 * Filtro global do painel (docx: "todos os gráficos e indicadores deverão
 * responder aos filtros selecionados").
 *
 * O recorte é um conjunto de anos, não um ano só: dá para somar 2024+2025+2026
 * segurando Ctrl no clique. Conjunto vazio significa acumulado da parceria —
 * "Acumulado" não é um item a mais na lista, é a ausência de recorte, e por
 * isso selecioná-lo limpa os anos em vez de conviver com eles.
 *
 * O recorte por linha de ação saiu daqui quando as linhas viraram páginas: a
 * página da Linha II já é o recorte da Linha II.
 */
@Injectable({ providedIn: 'root' })
export class GlobalFilterService {
  readonly anos = ANOS_PARCERIA;

  private selecionados = signal<number[]>([]);

  /** Anos do recorte, ordenados. Vazio = acumulado. */
  readonly selecao = this.selecionados.asReadonly();

  /** `null` = acumulado da parceria; caso contrário, os anos escolhidos. */
  readonly recorte = computed<number[] | null>(() => {
    const anos = this.selecionados();
    return anos.length ? anos : null;
  });

  readonly ativo = computed(() => this.selecionados().length > 0);

  /** Recorte por extenso — cabeçalhos e notas repetem isto ao leitor. */
  readonly rotulo = computed(() => {
    const anos = this.selecionados();
    if (!anos.length) return 'acumulado da parceria';
    if (anos.length === 1) return `ano de ${anos[0]}`;
    const ultimo = anos[anos.length - 1];
    return `anos de ${anos.slice(0, -1).join(', ')} e ${ultimo}`;
  });

  /** Rótulo curto para o próprio controle de filtro. */
  readonly rotuloCurto = computed(() => {
    const anos = this.selecionados();
    if (!anos.length) return 'Acumulado';
    return anos.join(' + ');
  });

  selecionado(ano: number): boolean {
    return this.selecionados().includes(ano);
  }

  /**
   * Clique simples troca o recorte; com Ctrl/Cmd, soma ou tira o ano do que já
   * está selecionado — o mesmo gesto de seleção múltipla que a pessoa já usa
   * em planilha e em gerenciador de arquivos.
   */
  alternar(ano: number, acumulando = false): void {
    this.selecionados.update((atuais) => {
      if (!acumulando) return atuais.length === 1 && atuais[0] === ano ? [] : [ano];
      const novos = atuais.includes(ano)
        ? atuais.filter((a) => a !== ano)
        : [...atuais, ano].sort((x, y) => x - y);
      return novos;
    });
  }

  limpar(): void {
    this.selecionados.set([]);
  }
}
