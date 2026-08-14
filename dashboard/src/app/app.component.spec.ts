import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

/** Dados mínimos para o painel se considerar carregado (ver DataService). */
const DADOS_EM_SESSAO = JSON.stringify({
  arquivo: 'planilha-de-teste.xlsx',
  lidoEm: new Date().toISOString(),
  indicadores: [],
  parceria: null,
  territorio: { atualizadoEm: '2026-01-01', totalUfs: 27, alcance: [], agentes: [], organizacoes: [] },
});

describe('AppComponent', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => sessionStorage.clear());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sem planilha carregada, mostra a tela de carga em vez do painel', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const html = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(html).toContain('Carregue a planilha de indicadores');
    expect(html).not.toContain('Impacto Territorial');
  });

  it('com dados na sessão, mostra o menu', () => {
    sessionStorage.setItem('ih.painel.dados', DADOS_EM_SESSAO);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Impacto Territorial');
  });
});
