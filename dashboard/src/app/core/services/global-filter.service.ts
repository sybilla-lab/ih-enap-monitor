import { Injectable, computed, signal } from '@angular/core';
import { ANOS_PARCERIA, LINHAS_ACAO, LinhaAcaoId } from '../models/indicadores.model';

/**
 * Filtro global do painel (docx: "todos os gráficos e indicadores deverão
 * responder aos filtros selecionados"). Qualquer página consome estes signals;
 * novos recortes (projeto, status…) entram aqui sem tocar nas páginas atuais.
 */
@Injectable({ providedIn: 'root' })
export class GlobalFilterService {
  readonly anos = ANOS_PARCERIA;
  readonly linhas = LINHAS_ACAO;

  /** null = acumulado da parceria (todos os anos). */
  readonly ano = signal<number | null>(null);
  /** null = todas as linhas de ação. */
  readonly linha = signal<LinhaAcaoId | null>(null);

  readonly ativo = computed(() => this.ano() !== null || this.linha() !== null);

  limpar(): void {
    this.ano.set(null);
    this.linha.set(null);
  }

  alternarLinha(linha: LinhaAcaoId): void {
    this.linha.update((atual) => (atual === linha ? null : linha));
  }
}
