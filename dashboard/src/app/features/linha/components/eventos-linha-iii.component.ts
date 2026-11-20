import { Component, computed, inject } from '@angular/core';
import { DataService } from '../../../core/services/data.service';
import { GlobalFilterService } from '../../../core/services/global-filter.service';
import { ehEventoDeConexao } from '../../../core/models/indicadores.model';
import { formatQuantidade } from '../../../core/util/numero.util';
import { StatTileComponent } from '../../../shared/components/stat-tile/stat-tile.component';

/**
 * Eventos da Linha III (revisão 04).
 *
 * A aba de eventos é a única fonte de público da linha: quantas pessoas se
 * inscreveram, quantas apareceram e como avaliaram. Os indicadores pactuados
 * contam atividades — este bloco conta gente, que é a pergunta que o cliente
 * faz sobre a Linha III e que a aba Metas não responde.
 *
 * Só entram as classificações que a revisão 04 define como evento realizado:
 * atividades de conexão/networking e oficinas do Plano Adicional. Cocriação,
 * conteúdo produzido e Semana de Inovação são metas próprias da linha e
 * aparecem na lista de indicadores, não aqui.
 */
@Component({
  selector: 'app-eventos-linha-iii',
  standalone: true,
  imports: [StatTileComponent],
  template: `
    <section class="eventos" aria-labelledby="eventos-titulo">
      <header class="eventos__cabecalho">
        <h2 id="eventos-titulo" class="eventos__titulo">Eventos da linha</h2>
        <p class="eventos__subtitulo">
          Atividades de conexão e networking e oficinas do Plano Adicional — {{ filtro.rotulo() }}.
          Os demais registros da aba (cocriação, conteúdo produzido e Semana de Inovação) cumprem
          metas próprias da linha e estão entre os indicadores acima.
        </p>
      </header>

      @if (!eventos().length) {
        <div class="app-card vazio">
          <p>
            Nenhum evento desta classificação no recorte.
            @if (semAno() > 0) {
              {{ semAno() }}
              {{ semAno() === 1 ? 'registro não tem ano' : 'registros não têm ano' }} na planilha e
              só aparecem no acumulado.
            }
          </p>
        </div>
      } @else {
        <div class="eventos__kpis">
          <app-stat-tile
            label="Eventos realizados"
            [value]="resumo().eventos"
            hint="conexão/networking e oficinas"
            icon="event"
            tone="accent"
          />
          <app-stat-tile
            label="Inscrições"
            [value]="resumo().inscricoes"
            [hint]="resumo().notaInscricoes"
            icon="how_to_reg"
          />
          <app-stat-tile
            label="Participantes"
            [value]="resumo().participantes"
            hint="presentes nos eventos"
            icon="groups"
          />
          <app-stat-tile
            label="NPS médio"
            [value]="resumo().nps"
            [hint]="resumo().notaNps"
            icon="sentiment_satisfied"
          />
        </div>

        <div class="app-card eventos__tabela">
          <div class="rolagem">
            <table class="tabela">
              <caption class="sr-only">
                Eventos de conexão e oficinas da Linha III no recorte selecionado
              </caption>
              <thead>
                <tr>
                  <th scope="col">Evento</th>
                  <th scope="col">Data</th>
                  <th scope="col">Formato</th>
                  <th scope="col" class="tabela__num">Inscrições</th>
                  <th scope="col" class="tabela__num">Participantes</th>
                  <th scope="col" class="tabela__num">NPS</th>
                </tr>
              </thead>
              <tbody>
                @for (e of eventos(); track e.nome + e.data) {
                  <tr>
                    <th scope="row" class="tabela__nome">{{ e.nome }}</th>
                    <td>{{ e.data || '—' }}</td>
                    <td>{{ e.formato || '—' }}</td>
                    <td class="tabela__num">{{ e.inscricoes ? fmt(e.inscricoes) : '—' }}</td>
                    <td class="tabela__num">{{ e.participantes ? fmt(e.participantes) : '—' }}</td>
                    <td class="tabela__num">{{ e.nps === null ? '—' : nota(e.nps) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <p class="fonte">
            Fonte: aba “LIII - Eventos, oficinas e SI + NPS” da Planilha Oficial de Indicadores.
            “—” é dado ainda não coletado para aquele evento: inscrições e NPS não existem em todo
            formato, e o NPS médio é a média só dos eventos que tiveram apuração.
          </p>
        </div>
      }
    </section>
  `,
  styles: `
    .eventos {
      display: flex;
      flex-direction: column;
      gap: 16px;

      &__cabecalho {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      &__titulo {
        margin: 0;
        font: var(--mat-sys-title-large);
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      &__subtitulo {
        margin: 0;
        max-width: 80ch;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      &__kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      &__tabela {
        padding: 20px 22px;
      }
    }

    .vazio {
      padding: 20px 22px;

      p {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    // Nomes de evento são longos: a tabela rola dentro do card em vez de
    // estourar a página, como na página de Comunicação.
    .rolagem {
      overflow-x: auto;
    }

    .tabela {
      width: 100%;
      border-collapse: collapse;
      font: var(--mat-sys-body-small);

      th {
        padding: 8px 14px 8px 0;
        text-align: left;
        font-weight: 600;
        color: var(--mat-sys-on-surface-variant);
      }

      thead th {
        border-bottom: 1px solid var(--mat-sys-on-surface);
        white-space: nowrap;
      }

      td {
        padding: 8px 14px 8px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        white-space: nowrap;
      }

      tbody th {
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        font-weight: 500;
        color: var(--mat-sys-on-surface);
      }

      &__nome {
        min-width: 260px;
        white-space: normal;
      }

      &__num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
    }

    .fonte {
      margin: 14px 0 0;
      max-width: 90ch;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
})
export class EventosLinhaIiiComponent {
  private dados = inject(DataService);
  readonly filtro = inject(GlobalFilterService);

  private deConexao = computed(() =>
    this.dados.eventos().filter((e) => ehEventoDeConexao(e.classificacao)),
  );

  /** Eventos sem ano na planilha: ficam fora de qualquer recorte anual. */
  readonly semAno = computed(() => this.deConexao().filter((e) => e.ano === null).length);

  readonly eventos = computed(() => {
    const recorte = this.filtro.recorte();
    if (recorte === null) return this.deConexao();
    return this.deConexao().filter((e) => e.ano !== null && recorte.includes(e.ano));
  });

  readonly resumo = computed(() => {
    const eventos = this.eventos();
    const inscricoes = eventos.reduce((s, e) => s + e.inscricoes, 0);
    const comInscricao = eventos.filter((e) => e.inscricoes > 0).length;
    // NPS não se soma: é a média dos eventos que tiveram apuração, e o card
    // diz de quantos, para não parecer que todos foram avaliados.
    const avaliados = eventos.map((e) => e.nps).filter((n): n is number => n !== null);
    const media = avaliados.length
      ? avaliados.reduce((s, n) => s + n, 0) / avaliados.length
      : null;

    return {
      eventos: formatQuantidade(eventos.length),
      inscricoes: inscricoes ? formatQuantidade(inscricoes) : '—',
      notaInscricoes:
        comInscricao === eventos.length
          ? 'em todos os eventos do recorte'
          : `declaradas em ${comInscricao} de ${eventos.length} eventos`,
      participantes: formatQuantidade(eventos.reduce((s, e) => s + e.participantes, 0)),
      nps: media === null ? '—' : this.nota(media),
      notaNps: avaliados.length
        ? `média de ${avaliados.length} ${avaliados.length === 1 ? 'evento avaliado' : 'eventos avaliados'} · meta 80`
        : 'sem apuração de NPS no recorte',
    };
  });

  fmt(valor: number): string {
    return formatQuantidade(valor);
  }

  /** NPS com uma casa, como no resto do painel. */
  nota(valor: number): string {
    return formatQuantidade(Math.round(valor * 10) / 10);
  }
}
