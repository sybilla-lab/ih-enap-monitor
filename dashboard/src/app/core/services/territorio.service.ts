import { Injectable, computed, inject } from '@angular/core';
import {
  Municipio,
  OrgRanking,
  RegistroAgente,
  RegistroAlcance,
  RegistroOrganizacao,
  Territorio,
  TerritorioBruto,
} from '../models/territorio.model';
import { GlobalFilterService } from './global-filter.service';
import { DataService } from './data.service';

/**
 * Dados territoriais. Os registros vêm da mesma origem do resto do painel
 * (DataService) e o agregado que a página consome é recalculado a cada mudança
 * do filtro global — é isso que faz o Impacto Territorial responder ao mesmo
 * recorte das demais páginas, em vez de exibir sempre o total da parceria.
 */
@Injectable({ providedIn: 'root' })
export class TerritorioService {
  private origem = inject(DataService);
  private filtro = inject(GlobalFilterService);

  readonly carregado = this.origem.carregado;
  readonly erro = this.origem.erro;

  readonly dados = computed<Territorio | null>(() => {
    const t = this.origem.territorio();
    if (!t) return null;
    const recorte = this.filtro.recorte();

    const noRecorte = <T extends { ano: number | null }>(r: T) =>
      recorte === null || (r.ano !== null && recorte.includes(r.ano));

    const alcance = t.alcance.filter(noRecorte);
    const agentes = t.agentes.filter(noRecorte);
    const organizacoes = t.organizacoes.filter(noRecorte);

    return {
      atualizadoEm: t.atualizadoEm,
      totalUfs: t.totalUfs,
      ...porUf(alcance, agentes),
      municipios: municipiosDe(agentes),
      organizacoesPublicas: organizacoes.length,
      organizacoesPorNivel: porNivel(organizacoes),
      rankingOrgsPorAgentes: rankingDe(agentes),
      totalAgentes: agentes.length,
      semData: recorte === null ? 0 : semData(t),
      vazio: !alcance.length && !agentes.length && !organizacoes.length,
      registros: { alcance, agentes, organizacoes },
    };
  });
}

/** Alcance = nº de iniciativas distintas por UF; prefeituras contam como uma. */
function porUf(
  alcance: RegistroAlcance[],
  agentes: RegistroAgente[],
): { alcancePorUf: Record<string, number>; ufsAlcancadas: number } {
  const porEstado = new Map<string, Set<string>>();
  const registrar = (uf: string, iniciativa: string) => {
    const set = porEstado.get(uf) ?? new Set<string>();
    set.add(iniciativa);
    porEstado.set(uf, set);
  };

  for (const r of alcance) registrar(r.uf, r.iniciativa);
  for (const a of agentes) {
    if (a.uf && a.cidade) registrar(a.uf, `Prefeitura ${a.cidade}`);
  }

  const alcancePorUf: Record<string, number> = {};
  for (const [uf, set] of porEstado) alcancePorUf[uf] = set.size;
  return { alcancePorUf, ufsAlcancadas: porEstado.size };
}

function municipiosDe(agentes: RegistroAgente[]): Municipio[] {
  const mapa = new Map<string, Municipio>();
  for (const a of agentes) {
    if (a.uf && a.cidade) mapa.set(`${a.cidade}|${a.uf}`, { cidade: a.cidade, uf: a.uf });
  }
  return [...mapa.values()].sort((x, y) => x.cidade.localeCompare(y.cidade));
}

function rankingDe(agentes: RegistroAgente[]): OrgRanking[] {
  const contagem = new Map<string, OrgRanking>();
  for (const a of agentes) {
    const atual = contagem.get(a.instituicao) ?? { nome: a.instituicao, agentes: 0, uf: a.uf };
    atual.agentes++;
    contagem.set(a.instituicao, atual);
  }
  return [...contagem.values()].sort((x, y) => y.agentes - x.agentes);
}

function porNivel(organizacoes: RegistroOrganizacao[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const o of organizacoes) mapa[o.nivel] = (mapa[o.nivel] ?? 0) + 1;
  return mapa;
}

/** Registros que ficam de fora de um recorte por ano por não terem data. */
function semData(t: TerritorioBruto): number {
  const semAno = <T extends { ano: number | null }>(r: T) => r.ano === null;
  return (
    t.alcance.filter(semAno).length +
    t.agentes.filter(semAno).length +
    t.organizacoes.filter(semAno).length
  );
}
