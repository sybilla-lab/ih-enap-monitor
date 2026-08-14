import { Component, inject } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  NavigationEnd,
  NavigationError,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NAV_ITEMS } from './layout/nav-items';
import { ThemeService } from './core/services/theme.service';
import { FiltroEscopoService } from './core/services/filtro-escopo.service';
import { DataService } from './core/services/data.service';
import { FilterDockComponent } from './shared/components/filter-dock/filter-dock.component';
import { CarregarComponent } from './features/carregar/carregar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    FilterDockComponent,
    CarregarComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly navItems = NAV_ITEMS;
  readonly theme = inject(ThemeService);
  readonly escopo = inject(FiltroEscopoService);
  readonly dados = inject(DataService);

  private breakpoints = inject(BreakpointObserver);
  readonly isHandset = toSignal(
    this.breakpoints.observe('(max-width: 959px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  private router = inject(Router);

  constructor() {
    /**
     * Cada página é um chunk carregado sob demanda. Se a aba fica aberta
     * enquanto uma versão nova é publicada (ou o dev server reinicia), os
     * arquivos que ela conhece somem e a navegação falha em silêncio — o menu
     * responde mas a área de conteúdo fica vazia. Aqui isso vira um reload
     * único, que pega a versão nova; a planilha carregada sobrevive porque
     * está em sessionStorage.
     */
    this.router.events
      .pipe(
        filter((e): e is NavigationError | NavigationEnd => e instanceof NavigationError || e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((evento) => {
        if (evento instanceof NavigationEnd) {
          sessionStorage.removeItem(CHAVE_RECARGA);
          return;
        }
        const falhaDeChunk = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(
          String(evento.error),
        );
        // A trava evita laço de recarga quando o erro não for de versão.
        if (falhaDeChunk && !sessionStorage.getItem(CHAVE_RECARGA)) {
          sessionStorage.setItem(CHAVE_RECARGA, '1');
          location.reload();
        }
      });
  }
}

const CHAVE_RECARGA = 'ih.recarga-por-versao';
