import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '../../core/services/data.service';
import { Solucao } from '../../core/models/indicadores.model';
import { formatQuantidade } from '../../core/util/numero.util';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';

/** Uma fatia de um agrupamento — barra proporcional ao maior do grupo. */
interface Fatia {
  rotulo: string;
  valor: string;
  pct: number;
}

interface Bloco {
  id: string;
  titulo: string;
  subtitulo: string;
  fatias: Fatia[];
}

const UFS_NOME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

/**
 * Banco de Soluções: o que o ecossistema submeteu aos desafios da parceria.
 *
 * É a página da aba "Soluções" pedida na revisão 04, e a mesma fonte dos dois
 * KPIs da Home ("Soluções geradas" e "Participantes em desafios") — um número
 * só, lido num lugar só.
 *
 * A aba não tem data, então esta página não responde ao filtro de ano (a rota
 * não declara o recorte, e por isso o controle nem aparece no topo). Os
 * recortes que fazem sentido aqui são os da própria aba: projeto de origem,
 * estágio, estado e área de atuação.
 */
@Component({
  selector: 'app-solucoes',
  standalone: true,
  imports: [MatIconModule, MatProgressBarModule, StatTileComponent],
  templateUrl: './solucoes.component.html',
  styleUrl: './solucoes.component.scss',
})
export class SolucoesComponent {
  readonly dados = inject(DataService);

  private banco = computed(() => this.dados.solucoes());
  readonly solucoes = computed(() => this.banco()?.solucoes ?? []);
  readonly vazio = computed(() => this.solucoes().length === 0);

  readonly resumo = computed(() => {
    const solucoes = this.solucoes();
    const ufs = new Set(solucoes.map((s) => s.uf).filter(Boolean));
    return {
      total: formatQuantidade(solucoes.length),
      participantes: formatQuantidade(this.banco()?.participantes ?? 0),
      projetos: formatQuantidade(new Set(solucoes.map((s) => s.projeto)).size),
      ufs: formatQuantidade(ufs.size),
      semUf: solucoes.filter((s) => !s.uf).length,
    };
  });

  readonly blocos = computed<Bloco[]>(() => {
    const solucoes = this.solucoes();
    return [
      {
        id: 'projeto',
        titulo: 'Por projeto de origem',
        subtitulo: 'O edital ou programa em que a solução foi inscrita.',
        fatias: fatias(contar(solucoes, (s) => [s.projeto])),
      },
      {
        id: 'status',
        titulo: 'Até onde cada solução chegou',
        subtitulo: 'Estágio registrado no banco: inscrita, selecionada ou premiada.',
        fatias: fatias(contar(solucoes, (s) => [s.status])),
      },
      {
        id: 'uf',
        titulo: 'De onde vêm as equipes',
        subtitulo: 'Estado de sede declarado na inscrição — os dez com mais soluções.',
        fatias: fatias(
          contar(solucoes, (s) => (s.uf ? [`${UFS_NOME[s.uf] ?? s.uf} (${s.uf})`] : [])),
          10,
        ),
      },
      {
        id: 'area',
        titulo: 'Áreas de atuação',
        subtitulo:
          'Declaradas pela própria equipe, e mais de uma por solução — os percentuais somam mais de 100%.',
        fatias: fatias(contar(solucoes, (s) => s.areas), 10),
      },
    ];
  });

  // ------------------------------------------------------- lista completa ----

  /** Recortes da lista; null em ambos = o banco inteiro. */
  readonly projetoAtivo = signal<string | null>(null);
  readonly statusAtivo = signal<string | null>(null);
  readonly busca = signal('');

  readonly projetos = computed(() => [...new Set(this.solucoes().map((s) => s.projeto))].sort());
  readonly status = computed(() => [...new Set(this.solucoes().map((s) => s.status))].sort());

  readonly filtradas = computed(() => {
    const projeto = this.projetoAtivo();
    const status = this.statusAtivo();
    const termo = this.busca().trim().toLowerCase();
    return this.solucoes().filter(
      (s) =>
        (!projeto || s.projeto === projeto) &&
        (!status || s.status === status) &&
        (!termo ||
          s.nome.toLowerCase().includes(termo) ||
          s.desafio.toLowerCase().includes(termo) ||
          s.cidade.toLowerCase().includes(termo)),
    );
  });

  readonly rotuloLista = computed(() => {
    const n = this.filtradas().length;
    const total = this.solucoes().length;
    if (n === total) return `${formatQuantidade(total)} soluções`;
    return `${formatQuantidade(n)} de ${formatQuantidade(total)} soluções`;
  });

  alternarProjeto(projeto: string): void {
    this.projetoAtivo.update((atual) => (atual === projeto ? null : projeto));
  }

  alternarStatus(status: string): void {
    this.statusAtivo.update((atual) => (atual === status ? null : status));
  }

  aoBuscar(evento: Event): void {
    this.busca.set((evento.target as HTMLInputElement).value);
  }

  limpar(): void {
    this.projetoAtivo.set(null);
    this.statusAtivo.set(null);
    this.busca.set('');
  }

  readonly temRecorte = computed(
    () => this.projetoAtivo() !== null || this.statusAtivo() !== null || this.busca().trim() !== '',
  );
}

/** Conta soluções por chave; uma solução pode entrar em mais de uma (áreas). */
function contar(solucoes: Solucao[], chaves: (s: Solucao) => string[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const s of solucoes) {
    for (const chave of chaves(s)) {
      if (chave) mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    }
  }
  return mapa;
}

/** Do mapa para barras: maior primeiro, barra proporcional ao maior do grupo. */
function fatias(mapa: Map<string, number>, limite?: number): Fatia[] {
  const ordenado = [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  const maior = ordenado[0]?.[1] ?? 1;
  return ordenado.slice(0, limite).map(([rotulo, valor]) => ({
    rotulo,
    valor: formatQuantidade(valor),
    pct: (valor / maior) * 100,
  }));
}
