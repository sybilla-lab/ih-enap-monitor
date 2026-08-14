import { Routes } from '@angular/router';

/**
 * `data.filtros` declara os recortes que cada página responde — é o que o dock
 * de filtros usa para se mostrar (ver FiltroEscopoService). Retorno responde só
 * a ano: é uma leitura da Linha IV, e recortar por outra linha não teria
 * significado.
 */
export const routes: Routes = [
  {
    path: 'home',
    title: 'Visão Geral — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano', 'linha'] },
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'retorno',
    title: 'Retorno da Parceria — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano'] },
    loadComponent: () =>
      import('./features/retorno/retorno.component').then((m) => m.RetornoComponent),
  },
  {
    path: 'territorio',
    title: 'Impacto Territorial — Parceria Enap × Impact Hub Brasil',
    data: { filtros: ['ano', 'linha'] },
    loadComponent: () =>
      import('./features/territorio/territorio.component').then((m) => m.TerritorioComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
