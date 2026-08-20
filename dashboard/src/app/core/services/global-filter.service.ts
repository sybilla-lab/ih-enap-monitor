import { Injectable, computed, signal } from '@angular/core';
import { ANOS_PARCERIA } from '../models/indicadores.model';

/**
 * Filtro global do painel (docx: "todos os gráficos e indicadores deverão
 * responder aos filtros selecionados"). Qualquer página consome estes signals;
 * novos recortes (projeto, status…) entram aqui sem tocar nas páginas atuais.
 *
 * O recorte por linha de ação saiu daqui quando as linhas viraram páginas: a
 * página da Linha II já é o recorte da Linha II, e manter as duas coisas
 * significava dois controles disputando o mesmo estado.
 */
@Injectable({ providedIn: 'root' })
export class GlobalFilterService {
  readonly anos = ANOS_PARCERIA;

  /** null = acumulado da parceria (todos os anos). */
  readonly ano = signal<number | null>(null);

  readonly ativo = computed(() => this.ano() !== null);

  /** Recorte por extenso — cabeçalhos e notas repetem isto ao leitor. */
  readonly rotulo = computed(() =>
    this.ano() === null ? 'acumulado da parceria' : `ano de ${this.ano()}`,
  );

  limpar(): void {
    this.ano.set(null);
  }
}
