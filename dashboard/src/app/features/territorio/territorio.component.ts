import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { TerritorioService } from '../../core/services/territorio.service';
import { GlobalFilterService } from '../../core/services/global-filter.service';
import { OrgRanking, UF_GRID } from '../../core/models/territorio.model';
import { formatQuantidade } from '../../core/util/numero.util';
import { StatTileComponent } from '../../shared/components/stat-tile/stat-tile.component';
import { BrazilTilemapComponent } from './components/brazil-tilemap.component';

interface Kpi {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
  tone?: 'default' | 'accent';
}

/** O que está fixado por clique — o mapa e o ranking abrem o mesmo painel. */
type Foco = { tipo: 'uf'; uf: string } | { tipo: 'org'; nome: string };

interface Iniciativa {
  nome: string;
  linha: string;
  ano: number | null;
}

@Component({
  selector: 'app-territorio',
  standalone: true,
  imports: [
    MatProgressBarModule,
    MatIconModule,
    StatTileComponent,
    BrazilTilemapComponent,
  ],
  host: { '(document:keydown.escape)': 'limparFoco()' },
  templateUrl: './territorio.component.html',
  styleUrl: './territorio.component.scss',
})
export class TerritorioComponent {
  readonly srv = inject(TerritorioService);
  private filtro = inject(GlobalFilterService);
  readonly formatar = formatQuantidade;

  private nomeUf = new Map(UF_GRID.map((u) => [u.sigla, u.nome]));

  /**
   * Duas camadas de interação: passar o mouse é preview (destaca no mapa e no
   * ranking, some ao sair) e clicar fixa — só o clique abre o painel com as
   * iniciativas por trás do número. Sem isso, o cruzamento mapa ↔ organizações
   * respondia ao hover mas nunca dizia *quais* iniciativas alcançaram o estado.
   */
  readonly ufHover = signal<string | null>(null);
  readonly foco = signal<Foco | null>(null);

  private painelDetalhe = viewChild<ElementRef<HTMLElement>>('painelDetalhe');

  constructor() {
    // O painel flutua fora do fluxo: mandar o foco para ele ao abrir mantém a
    // navegação por teclado no lugar certo (e o Esc fecha de onde estiver).
    effect(() => this.painelDetalhe()?.nativeElement.focus({ preventScroll: true }));
  }

  /** Recorte em vigor por extenso — o cabeçalho diz o que está sendo somado. */
  readonly recorte = computed(() => {
    const ano = this.filtro.ano();
    const linha = this.filtro.linha();
    const partes = [ano === null ? 'acumulado da parceria' : String(ano)];
    if (linha) partes.push(linha);
    return partes.join(' · ');
  });

  /** UFs que têm ao menos uma organização no ranking (para o mapa realçar de volta). */
  readonly ufsComOrg = computed(() => {
    const set = new Set<string>();
    for (const o of this.srv.dados()?.rankingOrgsPorAgentes ?? []) {
      if (o.uf) set.add(o.uf);
    }
    return set;
  });

  /** UF fixada: direto, ou a do estado da organização fixada. */
  readonly ufFixada = computed(() => {
    const f = this.foco();
    if (!f) return null;
    if (f.tipo === 'uf') return f.uf;
    return this.orgDoRanking(f.nome)?.uf ?? null;
  });

  readonly ufEmDestaque = computed(() => this.ufHover() ?? this.ufFixada());

  readonly kpis = computed<Kpi[]>(() => {
    const t = this.srv.dados();
    if (!t) return [];
    return [
      {
        label: 'Estados alcançados',
        value: `${t.ufsAlcancadas} de ${t.totalUfs}`,
        hint: `unidades da federação com ao menos uma frente · ${this.recorte()}`,
        icon: 'map',
        tone: 'accent',
      },
      {
        label: 'Organizações públicas engajadas',
        value: this.formatar(t.organizacoesPublicas),
        hint: this.resumoNiveis(t.organizacoesPorNivel),
        icon: 'account_balance',
      },
      {
        label: 'Agentes públicos engajados',
        value: this.formatar(t.totalAgentes),
        hint: `em ${t.rankingOrgsPorAgentes.length} organizações`,
        icon: 'groups',
      },
      {
        label: 'Municípios com projeto',
        value: this.formatar(t.municipios.length),
        hint: 'identificados nos registros de atividades',
        icon: 'location_city',
      },
    ];
  });

  /** Detalhe do estado sob o cursor, para a legenda ao lado do mapa. */
  readonly detalheUf = computed(() => {
    const sigla = this.ufEmDestaque();
    const t = this.srv.dados();
    if (!sigla || !t) return null;
    return {
      sigla,
      nome: this.nomeUf.get(sigla) ?? sigla,
      alcance: t.alcancePorUf[sigla] ?? 0,
    };
  });

  /** Estado em destaque que não tem nenhuma organização no ranking. */
  readonly ufSemOrg = computed(() => {
    const uf = this.ufEmDestaque();
    return uf !== null && !this.ufsComOrg().has(uf) ? (this.nomeUf.get(uf) ?? uf) : null;
  });

  readonly rankingMax = computed(() => {
    const r = this.srv.dados()?.rankingOrgsPorAgentes ?? [];
    return r.length ? r[0].agentes : 1;
  });

  readonly niveis = computed(() => {
    const map = this.srv.dados()?.organizacoesPorNivel ?? {};
    return Object.entries(map).map(([nivel, total]) => ({ nivel, total }));
  });

  /** Conteúdo do painel: as iniciativas por trás do estado ou da organização. */
  readonly painel = computed(() => {
    const f = this.foco();
    const t = this.srv.dados();
    if (!f || !t) return null;

    if (f.tipo === 'uf') {
      const nome = this.nomeUf.get(f.uf) ?? f.uf;
      const vistas = new Map<string, Iniciativa>();
      for (const r of t.registros.alcance) {
        if (r.uf === f.uf) vistas.set(r.iniciativa, { nome: r.iniciativa, linha: r.linha, ano: r.ano });
      }
      const organizacoes = t.rankingOrgsPorAgentes.filter((o) => o.uf === f.uf);
      return {
        tipo: 'uf' as const,
        titulo: nome,
        sigla: f.uf,
        iniciativas: [...vistas.values()].sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0)),
        organizacoes,
        // Bate com o número do mapa: lá o alcance também soma as prefeituras
        // que entraram pelo vínculo dos agentes, não só as iniciativas.
        frentes: vistas.size + organizacoes.length,
      };
    }

    const agentes = t.registros.agentes.filter((a) => a.instituicao === f.nome);
    const comLocal = agentes.find((a) => a.cidade && a.uf);
    return {
      tipo: 'org' as const,
      titulo: f.nome,
      agentes: agentes.length,
      local: comLocal ? `${comLocal.cidade}/${comLocal.uf}` : null,
      projetos: [...new Set(agentes.map((a) => a.projeto))],
      // A aba de organizações da Linha IV usa o nome por extenso; casa pela
      // sigla entre parênteses quando é a mesma instituição.
      engajamento: this.engajamentoDe(f.nome),
    };
  });

  nomeDaUf(sigla: string): string {
    return this.nomeUf.get(sigla) ?? sigla;
  }

  /**
   * Um item do ranking recua quando há outro em foco. Se o estado em destaque
   * não tem nenhuma organização, nada recua — apagar a lista inteira dava a
   * impressão de que o cruzamento tinha quebrado.
   */
  orgApagada(org: OrgRanking): boolean {
    const f = this.foco();
    if (f?.tipo === 'org') return org.nome !== f.nome;
    const uf = this.ufEmDestaque();
    if (uf === null || !this.ufsComOrg().has(uf)) return false;
    return org.uf !== uf;
  }

  orgEmFoco(org: OrgRanking): boolean {
    const f = this.foco();
    if (f?.tipo === 'org') return org.nome === f.nome;
    return org.uf !== null && this.ufEmDestaque() === org.uf;
  }

  /** Hover numa organização projeta o foco no estado dela (destaca o tile). */
  focarOrg(uf: string | null): void {
    this.ufHover.set(uf);
  }

  alternarUf(uf: string): void {
    const f = this.foco();
    this.foco.set(f?.tipo === 'uf' && f.uf === uf ? null : { tipo: 'uf', uf });
  }

  alternarOrg(nome: string): void {
    const f = this.foco();
    this.foco.set(f?.tipo === 'org' && f.nome === nome ? null : { tipo: 'org', nome });
  }

  limparFoco(): void {
    this.foco.set(null);
  }

  private orgDoRanking(nome: string): OrgRanking | undefined {
    return this.srv.dados()?.rankingOrgsPorAgentes.find((o) => o.nome === nome);
  }

  private engajamentoDe(nome: string): string | null {
    const alvo = nome.trim().toLowerCase();
    // Só nome idêntico ou sigla entre parênteses ("... (MDS)"). Nada de busca
    // por substring: siglas curtas casariam com instituições que não são a mesma.
    const org = this.srv.dados()?.registros.organizacoes.find((o) => {
      const completo = o.nome.trim().toLowerCase();
      return completo === alvo || completo.endsWith(`(${alvo})`);
    });
    return org?.engajamento || null;
  }

  private resumoNiveis(porNivel: Record<string, number>): string {
    return Object.entries(porNivel)
      .map(([nivel, n]) => `${n} ${nivel.toLowerCase()}`)
      .join(' · ');
  }
}
