import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';

import { routes } from './app.routes';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Sem isto o Angular preserva a rolagem entre rotas: sair de uma página
      // rolada abria a próxima no meio. Cada seção começa do topo, e âncoras
      // (#id) continuam funcionando.
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    // Fica provido mesmo sem uso hoje: os dados vêm da planilha carregada no
    // navegador, e a API prevista para o lugar dela vai precisar do HttpClient.
    provideHttpClient(withFetch()),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
  ],
};
