import { Injectable, computed, signal } from '@angular/core';
import { DadosPainel, PlanilhaInvalidaError, lerPlanilha } from '../data/planilha';

const CHAVE_SESSAO = 'ih.painel.dados';

/**
 * Origem única dos dados do painel.
 *
 * As páginas consomem só os signals daqui (`indicadores`, `parceria`,
 * `territorio`) e não sabem de onde os dados vieram. Hoje vêm da planilha que a
 * pessoa carrega no navegador — nada é publicado junto com o código enquanto
 * não existir backend. Quando a API entrar, ela preenche o mesmo `aplicar()` e
 * nenhuma página muda: é esse o ponto de troca.
 *
 * Os dados ficam em sessionStorage (não localStorage): sobrevivem a um F5 e
 * desaparecem quando a aba fecha.
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private dados = signal<DadosPainel | null>(null);

  readonly indicadores = computed(() => this.dados()?.indicadores ?? []);
  readonly parceria = computed(() => this.dados()?.parceria ?? null);
  readonly territorio = computed(() => this.dados()?.territorio ?? null);

  /** Há dados para exibir? É o que decide entre a tela de carga e o painel. */
  readonly pronto = computed(() => this.dados() !== null);
  /** Mantido para as páginas, que checam carregamento antes de renderizar. */
  readonly carregado = this.pronto;

  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);

  /** De onde vieram os dados em uso — o rodapé e a toolbar mostram isso. */
  readonly origem = computed(() => {
    const d = this.dados();
    return d ? { arquivo: d.arquivo, lidoEm: new Date(d.lidoEm) } : null;
  });

  constructor() {
    this.restaurar();
  }

  async carregarPlanilha(arquivo: File): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.aplicar(await lerPlanilha(arquivo));
    } catch (err) {
      console.error('Erro ao ler a planilha:', err);
      this.erro.set(
        err instanceof PlanilhaInvalidaError
          ? err.message
          : 'Não foi possível ler este arquivo. Confira se é a Planilha Oficial de Indicadores em .xlsx.',
      );
    } finally {
      this.carregando.set(false);
    }
  }

  /** Descarta os dados desta sessão e volta para a tela de carga. */
  limpar(): void {
    this.dados.set(null);
    this.erro.set(null);
    sessionStorage.removeItem(CHAVE_SESSAO);
  }

  private aplicar(dados: DadosPainel): void {
    this.dados.set(dados);
    try {
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
    } catch {
      // Sem espaço em sessionStorage o painel segue: só perde o F5.
    }
  }

  private restaurar(): void {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return;
    try {
      this.dados.set(JSON.parse(bruto) as DadosPainel);
    } catch {
      sessionStorage.removeItem(CHAVE_SESSAO);
    }
  }
}
