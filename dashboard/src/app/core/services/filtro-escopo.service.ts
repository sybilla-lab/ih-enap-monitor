import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

/**
 * Só resta o recorte por ano. A linha de ação foi promovida a página (uma para
 * cada linha), então filtrar por linha deixou de fazer sentido: a página já é
 * o recorte.
 */
export type DimensaoFiltro = 'ano';

/**
 * Escopo do filtro flutuante: quais recortes a página aberta sabe aplicar.
 *
 * Cada rota declara isso em `data.filtros` — a barra só mostra o que aquela
 * página realmente responde. Prometer um recorte que a página ignora é pior do
 * que não oferecê-lo: o número não muda e o leitor não sabe por quê.
 */
@Injectable({ providedIn: 'root' })
export class FiltroEscopoService {
  private router = inject(Router);

  readonly dimensoes = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.dimensoesDaRota()),
    ),
    { initialValue: [] as DimensaoFiltro[] },
  );

  readonly visivel = computed(() => this.dimensoes().length > 0);
  readonly aceita = (dimensao: DimensaoFiltro) => this.dimensoes().includes(dimensao);

  /** Estado do dock; recolhido devolve a área de leitura sem perder o recorte. */
  readonly minimizado = signal(false);

  private dimensoesDaRota(): DimensaoFiltro[] {
    let rota = this.router.routerState.root;
    while (rota.firstChild) rota = rota.firstChild;
    return (rota.snapshot.data['filtros'] ?? []) as DimensaoFiltro[];
  }
}
