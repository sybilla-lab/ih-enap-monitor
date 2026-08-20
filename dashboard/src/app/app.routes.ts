import { Routes } from '@angular/router';
import { LINHAS_ACAO } from './core/models/indicadores.model';

/**
 * `data.filtros` declara os recortes que cada página responde — é o que o dock
 * de filtros usa para se mostrar (ver FiltroEscopoService). Só existe o recorte
 * por ano: as linhas de ação deixaram de ser filtro e viraram páginas próprias,
 * cada uma com as metas da sua linha.
 */
const carregarLinha = () =>
  import('./features/linha/linha.component').then((m) => m.LinhaComponent);

export const routes: Routes = [
  {
    path: 'home',
    title: 'Visão Geral — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano'] },
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'progresso',
    title: 'Progresso das Metas — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano'] },
    loadComponent: () =>
      import('./features/progresso/progresso.component').then((m) => m.ProgressoComponent),
  },
  {
    path: 'linha-i',
    title: 'Linha I · Projetos de inovação aberta — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano'], linha: LINHAS_ACAO[0] },
    loadComponent: carregarLinha,
  },
  {
    path: 'linha-ii',
    title: 'Linha II · Aceleração e Incubação — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano'], linha: LINHAS_ACAO[1] },
    loadComponent: carregarLinha,
  },
  {
    path: 'linha-iii',
    title: 'Linha III · Cultura, conhecimento e comunidades — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano'], linha: LINHAS_ACAO[2] },
    loadComponent: carregarLinha,
  },
  {
    path: 'linha-iv',
    title: 'Linha IV · Prospecção e Retorno da Parceria — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano'], linha: LINHAS_ACAO[3] },
    loadComponent: carregarLinha,
  },
  {
    path: 'territorio',
    title: 'Impacto Territorial — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano'] },
    loadComponent: () =>
      import('./features/territorio/territorio.component').then((m) => m.TerritorioComponent),
  },
  {
    path: 'relatorio',
    title: 'Relatório Executivo — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano'] },
    loadComponent: () =>
      import('./features/relatorio/relatorio.component').then((m) => m.RelatorioComponent),
  },
  // Endereço da versão anterior: o retorno agora vive dentro da Linha IV.
  { path: 'retorno', redirectTo: 'linha-iv' },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
