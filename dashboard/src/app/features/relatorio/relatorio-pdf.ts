import { GraficoAvanco } from './grafico-svg';

/**
 * Geração do PDF no próprio navegador, com download direto e nome definido.
 *
 * Por que não usar o "imprimir" do navegador: o diálogo de impressão é do
 * navegador e nenhuma API deixa o JavaScript pular a escolha de nome e pasta.
 * Para o clique baixar o arquivo pronto, o PDF precisa ser montado aqui —
 * pdfmake escreve texto e vetores de verdade (nada de captura de tela), e a
 * biblioteca só é baixada quando alguém clica no botão.
 *
 * Fontes: as 14 padrão do PDF (Helvetica), que não precisam ser embutidas — o
 * arquivo fica leve e abre igual em qualquer leitor. Por isso o PDF usa
 * Helvetica onde a tela usa Roboto/Source Serif: a hierarquia é a mesma, o
 * desenho da letra é o que muda.
 */

// Mesma família do painel: tons neutros da paleta gerada do Verde Enap e o
// verde claro como cor de dado. O PDF nasce sempre em modo claro.
const TINTA = '#191c1d';
const TINTA2 = '#5c5f5f';
const FIO = '#d8dadb';
const ACENTO = '#00918e';
const VERDE_ENAP = '#024248';
const NEUTRO = '#8a9797';
const TRILHO = '#e6e8e9';

export interface ItemTabelaIndicador {
  linha: string;
  nome: string;
  meta: string;
  realizado: string;
  pctLabel: string;
  barra: number;
  atingido: boolean;
}

export interface ModeloRelatorio {
  recorte: string;
  emitidoEm: Date;
  arquivo: string;
  panorama: { valor: string; pct: number; total: number; atingidos: number };
  numerosChave: { rotulo: string; valor: string; nota: string }[];
  progressoPorLinha: { rotulo: string; detalhe: string; valor: string; preenchimento: number }[];
  indicadores: ItemTabelaIndicador[];
  grafico: GraficoAvanco | null;
  avanco: { ano: number; realizado: string; plano: string; parcial: boolean }[];
  leituraAvanco: string | null;
  notaAvanco: string;
  retorno: {
    alavancagem: string | null;
    aporte: string;
    captado: string;
    liquido: string;
    roi: string;
    larguraAporte: number;
    larguraCaptado: number;
  } | null;
  captacaoPorAno: {
    ano: string;
    aporte: string;
    meta: string;
    realizado: string;
    preenchimento: number;
    referencia: number;
  }[];
  projecoes: {
    faixa: string;
    acumulada: string;
    cenarios: { aporte: string; central: string; minimo: string; maximo: string }[];
  } | null;
  escala: { meta: number; projecao: number; multiplo: string; nota: string } | null;
  territorio: {
    ufsAlcancadas: number;
    totalUfs: number;
    organizacoes: number;
    niveis: string;
    agentes: number;
    instituicoes: number;
    municipios: string;
    totalMunicipios: number;
    mapaSvg: string;
    estados: { uf: string; nome: string; frentes: number; iniciativas: string }[];
    ranking: { nome: string; agentes: number; preenchimento: number }[];
  } | null;
  notas: { titulo: string; texto: string }[];
}

/**
 * Lê um arquivo do próprio site e devolve como data URI — é o formato que o
 * pdfmake aceita para imagens. Resolve contra o `base href` porque o painel é
 * publicado numa subpasta. Se a marca não estiver lá, o documento sai sem ela
 * em vez de falhar.
 */
async function comoDataUri(caminho: string): Promise<string | null> {
  try {
    const resposta = await fetch(new URL(caminho, document.baseURI).href);
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    return await new Promise<string | null>((resolve) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(typeof leitor.result === 'string' ? leitor.result : null);
      leitor.onerror = () => resolve(null);
      leitor.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Divide em fileiras de tamanho fixo, completando a última com vazios. */
function emFileiras<T>(itens: T[], porFileira: number): (T | null)[][] {
  const fileiras: (T | null)[][] = [];
  for (let i = 0; i < itens.length; i += porFileira) {
    const fileira: (T | null)[] = itens.slice(i, i + porFileira);
    while (fileira.length < porFileira) fileira.push(null);
    fileiras.push(fileira);
  }
  return fileiras;
}

/** Barra de proporção desenhada com vetor (sem imagem). */
function barra(preenchimento: number, largura = 70, referencia?: number) {
  const altura = 5;
  const canvas: Record<string, unknown>[] = [
    { type: 'rect', x: 0, y: 0, w: largura, h: altura, r: 2.5, color: TRILHO },
  ];
  if (referencia !== undefined && referencia > 0) {
    canvas.push({
      type: 'rect',
      x: 0,
      y: 0,
      w: Math.max((referencia / 100) * largura, 1),
      h: altura,
      r: 2.5,
      color: NEUTRO,
      fillOpacity: 0.45,
    });
  }
  if (preenchimento > 0) {
    canvas.push({
      type: 'rect',
      x: 0,
      y: 0,
      w: Math.max((preenchimento / 100) * largura, 1),
      h: altura,
      r: 2.5,
      color: ACENTO,
    });
  }
  return { canvas, margin: [0, 3, 0, 0] };
}

const fio = (larguraTotal: number, cor = FIO) => ({
  canvas: [{ type: 'line', x1: 0, y1: 0, x2: larguraTotal, y2: 0, lineWidth: 0.7, lineColor: cor }],
  margin: [0, 6, 0, 10],
});

/**
 * A quebra de página vai no próprio cabeçalho da seção. Um nó vazio só para
 * quebrar (`{text:'', pageBreak:'before'}`) rende página em branco quando a
 * seção anterior termina justo no fim da folha.
 */
function cabecalhoSecao(numero: string, titulo: string, subtitulo: string, novaPagina = true) {
  return [
    {
      pageBreak: novaPagina ? 'before' : undefined,
      columns: [
        { text: numero, width: 26, color: ACENTO, bold: true, fontSize: 13 },
        [
          { text: titulo, fontSize: 15, bold: true, color: TINTA },
          { text: subtitulo, fontSize: 8.5, color: TINTA2, margin: [0, 2, 0, 0] },
        ],
      ],
      margin: [0, 0, 0, 4],
    },
    fio(515, TINTA),
  ];
}

/** O gráfico de avanço, em SVG, reaproveitando a geometria da tela. */
function svgAvanco(g: GraficoAvanco): string {
  const c = g.caixa;
  const grade = g.grade
    .map(
      (l) =>
        `<line x1="${c.margemEsq}" x2="${c.largura - c.margemDir}" y1="${l.y}" y2="${l.y}" stroke="${FIO}" stroke-width="1"/>` +
        `<text x="${c.margemEsq - 6}" y="${l.y + 3}" text-anchor="end" font-family="Helvetica" font-size="9" fill="${TINTA2}">${l.rotulo}</text>`,
    )
    .join('');
  const anos = g.anos
    .map(
      (a) =>
        `<text x="${a.x}" y="${c.altura - 8}" text-anchor="middle" font-family="Helvetica" font-size="9" fill="${TINTA2}">${a.rotulo}</text>`,
    )
    .join('');
  const marcas = g.marcas
    .map((m) =>
      m.parcial
        ? `<circle cx="${m.x}" cy="${m.y}" r="3.5" fill="#ffffff" stroke="${ACENTO}" stroke-width="2"/>`
        : `<circle cx="${m.x}" cy="${m.y}" r="3.5" fill="${ACENTO}"/>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.largura} ${c.altura}" width="${c.largura}" height="${c.altura}">
    ${grade}
    <path d="${g.areaRealizado}" fill="${ACENTO}" fill-opacity="0.10"/>
    <path d="${g.linhaPlano}" fill="none" stroke="${NEUTRO}" stroke-width="1.5" stroke-dasharray="5 5"/>
    <path d="${g.linhaRealizado}" fill="none" stroke="${ACENTO}" stroke-width="2"/>
    ${g.linhaParcial ? `<path d="${g.linhaParcial}" fill="none" stroke="${ACENTO}" stroke-width="2" stroke-dasharray="2 3"/>` : ''}
    ${marcas}${anos}
  </svg>`;
}

const layoutTabela = {
  hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
    i === 0 ? 0 : i === 1 ? 0.8 : i === node.table.body.length ? 0 : 0.5,
  vLineWidth: () => 0,
  hLineColor: (i: number) => (i === 1 ? TINTA : FIO),
  paddingTop: () => 5,
  paddingBottom: () => 5,
  paddingLeft: () => 0,
  paddingRight: (i: number, node: { table: { widths: unknown[] } }) =>
    i === node.table.widths.length - 1 ? 0 : 8,
};

/** Monta o documento e dispara o download com nome pronto. */
export async function baixarRelatorio(m: ModeloRelatorio): Promise<void> {
  const [{ default: pdfMake }, { default: helvetica }, logoEnap, logoIh] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/standard-fonts/Helvetica'),
    // Versões coloridas: o PDF sai sempre em fundo claro.
    comoDataUri('logos/enap.png'),
    comoDataUri('logos/impact-hub.png'),
  ]);
  pdfMake.addFontContainer(helvetica);

  const data = m.emitidoEm.toLocaleDateString('pt-BR');
  const conteudo: unknown[] = [];

  // ------------------------------------------------------------- capa ----
  conteudo.push(
    // Assinatura conjunta na hierarquia do brandbook: Enap maior, Impact Hub
    // em seguida, separados por um fio.
    {
      columns: [
        logoEnap
          ? { image: logoEnap, width: 92, margin: [0, 0, 0, 0] }
          : { text: 'Enap', bold: true, fontSize: 11, color: VERDE_ENAP },
        {
          width: 1,
          canvas: [{ type: 'line', x1: 0, y1: 6, x2: 0, y2: 30, lineWidth: 0.8, lineColor: FIO }],
          margin: [10, 0, 10, 0],
        },
        logoIh
          ? { image: logoIh, width: 62, margin: [0, 6, 0, 0] }
          : { text: 'Impact Hub Brasil', bold: true, fontSize: 10 },
        { text: '', width: '*' },
      ],
      columnGap: 0,
      margin: [0, 0, 0, 54],
    },
    {
      text: 'PROGRAMA DE PARCERIA · 2024–2028',
      fontSize: 8,
      color: TINTA2,
      characterSpacing: 1.2,
    },
    { text: 'Relatório executivo de indicadores', fontSize: 30, bold: true, margin: [0, 8, 0, 0] },
    { text: m.recorte, fontSize: 12, color: ACENTO, margin: [0, 10, 0, 0] },
    {
      columns: [
        [
          { text: 'Emitido em', fontSize: 8, color: TINTA2 },
          { text: data, fontSize: 10, bold: true },
        ],
        [
          { text: 'Fonte', fontSize: 8, color: TINTA2 },
          { text: m.arquivo, fontSize: 10, bold: true },
        ],
        [
          { text: 'Indicadores no recorte', fontSize: 8, color: TINTA2 },
          { text: String(m.panorama.total), fontSize: 10, bold: true },
        ],
      ],
      columnGap: 20,
      margin: [0, 34, 0, 0],
    },
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: 'Cumprimento médio das metas', fontSize: 9, color: TINTA2 },
                { text: m.panorama.valor, fontSize: 40, bold: true, margin: [0, 4, 0, 6] },
                barra(m.panorama.pct, 460),
                {
                  text: `${m.panorama.atingidos} de ${m.panorama.total} indicadores atingiram a meta do recorte`,
                  fontSize: 8,
                  color: TINTA2,
                  margin: [0, 8, 0, 0],
                },
              ],
              margin: [12, 12, 12, 12],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
        hLineColor: () => FIO,
        vLineColor: () => FIO,
      },
      margin: [0, 28, 0, 24],
    },
    // Dez indicadores não cabem numa fileira só de A4: quebra em blocos de
    // quatro, com as colunas vazias preenchidas para as larguras não dançarem
    // entre as fileiras.
    ...emFileiras(m.numerosChave, 4).map((fileira) => ({
      columns: fileira.map((n) =>
        n
          ? {
              stack: [
                { text: n.rotulo, fontSize: 8, color: TINTA2 },
                { text: n.valor, fontSize: 12, bold: true, margin: [0, 3, 0, 2] },
                { text: n.nota, fontSize: 7.5, color: TINTA2 },
              ],
            }
          : { text: '' },
      ),
      columnGap: 16,
      margin: [0, 0, 0, 14],
    })),
  );

  // ---------------------------------------------- 01 metas e cumprimento ----
  conteudo.push(
    ...cabecalhoSecao('01', 'Metas e cumprimento', 'Cada indicador do recorte, com meta, realizado e o quanto foi cumprido.'),
  );

  for (const l of m.progressoPorLinha) {
    conteudo.push({
      columns: [
        [
          { text: l.rotulo, fontSize: 10 },
          { text: l.detalhe, fontSize: 8, color: TINTA2, margin: [0, 1, 0, 0] },
        ],
        { width: 90, ...barra(l.preenchimento, 90) },
        { width: 34, text: l.valor, fontSize: 10, bold: true, alignment: 'right' },
      ],
      columnGap: 12,
      margin: [0, 0, 0, 10],
    });
  }

  conteudo.push({
    table: {
      headerRows: 1,
      widths: [18, '*', 62, 62, 100],
      body: [
        ['Linha', 'Indicador', 'Meta', 'Realizado', 'Cumprimento'].map((t, i) => ({
          text: t,
          fontSize: 8,
          bold: true,
          color: TINTA2,
          alignment: i === 2 || i === 3 ? 'right' : 'left',
        })),
        ...m.indicadores.map((i) => [
          { text: i.linha, fontSize: 8.5, bold: true },
          { text: i.nome, fontSize: 8.5 },
          { text: i.meta, fontSize: 8.5, alignment: 'right' },
          { text: i.realizado, fontSize: 8.5, alignment: 'right' },
          {
            columns: [
              { width: 58, ...barra(i.barra, 58) },
              {
                width: 30,
                text: i.pctLabel,
                fontSize: 8.5,
                alignment: 'right',
                bold: i.atingido,
                color: i.atingido ? ACENTO : TINTA,
              },
            ],
            columnGap: 6,
          },
        ]),
      ],
    },
    layout: layoutTabela,
    margin: [0, 14, 0, 0],
  });

  // ------------------------------------------------ 02 avanço rumo a 2028 ----
  conteudo.push(
    ...cabecalhoSecao('02', 'Avanço rumo a 2028', 'Quanto da meta final já foi entregue, contra o que o cronograma previa.'),
  );

  if (m.grafico) {
    conteudo.push({ svg: svgAvanco(m.grafico), width: 515, margin: [0, 4, 0, 8] });
    conteudo.push({
      columns: [
        { width: 'auto', canvas: [{ type: 'line', x1: 0, y1: 4, x2: 16, y2: 4, lineWidth: 2, lineColor: ACENTO }] },
        { width: 'auto', text: 'Entregue da meta 2028', fontSize: 8, color: TINTA2, margin: [4, 0, 14, 0] },
        { width: 'auto', canvas: [{ type: 'line', x1: 0, y1: 4, x2: 16, y2: 4, lineWidth: 2, lineColor: NEUTRO, dash: { length: 3 } }] },
        { width: 'auto', text: 'Plano (metas acumuladas)', fontSize: 8, color: TINTA2, margin: [4, 0, 14, 0] },
        { width: 'auto', canvas: [{ type: 'line', x1: 0, y1: 4, x2: 16, y2: 4, lineWidth: 2, lineColor: ACENTO, dash: { length: 1, space: 2 } }] },
        { width: '*', text: 'Ano em curso (parcial)', fontSize: 8, color: TINTA2, margin: [4, 0, 0, 0] },
      ],
      margin: [0, 0, 0, 12],
    });
  }

  if (m.leituraAvanco) {
    conteudo.push({ text: m.leituraAvanco, fontSize: 9.5, margin: [0, 0, 0, 12] });
  }

  conteudo.push(
    {
      table: {
        headerRows: 1,
        widths: ['*', 130, 130],
        body: [
          ['Ano', 'Entregue da meta 2028', 'Plano'].map((t, i) => ({
            text: t,
            fontSize: 8,
            bold: true,
            color: TINTA2,
            alignment: i === 0 ? 'left' : 'right',
          })),
          ...m.avanco.map((a) => [
            { text: `${a.ano}${a.parcial ? ' (em curso)' : ''}`, fontSize: 8.5 },
            { text: a.realizado, fontSize: 8.5, alignment: 'right' },
            { text: a.plano, fontSize: 8.5, alignment: 'right' },
          ]),
        ],
      },
      layout: layoutTabela,
    },
    { text: m.notaAvanco, fontSize: 8, color: TINTA2, margin: [0, 10, 0, 0] },
  );

  // --------------------------------------------------------- 03 retorno ----
  if (m.retorno) {
    const r = m.retorno;
    conteudo.push(
      ...cabecalhoSecao('03', 'Retorno da parceria', 'O que a Enap aportou e o que voltou em captação de fontes externas.'),
      {
        columns: [
          {
            width: 150,
            stack: [
              { text: r.alavancagem ?? '—', fontSize: 30, bold: true },
              {
                text: r.alavancagem
                  ? 'captados para cada R$ 1,00 aportado'
                  : 'sem aporte registrado neste recorte',
                fontSize: 8,
                color: TINTA2,
                margin: [0, 4, 0, 0],
              },
            ],
          },
          {
            width: '*',
            stack: [
              {
                columns: [
                  { width: 92, text: 'Aporte da Enap', fontSize: 8, color: TINTA2, margin: [0, 3, 0, 0] },
                  { width: 150, ...barra(r.larguraAporte, 150) },
                  { width: '*', text: r.aporte, fontSize: 9, bold: true, alignment: 'right', margin: [0, 1, 0, 0] },
                ],
                columnGap: 8,
                margin: [0, 0, 0, 8],
              },
              {
                columns: [
                  { width: 92, text: 'Captação externa', fontSize: 8, color: TINTA2, margin: [0, 3, 0, 0] },
                  { width: 150, ...barra(r.larguraCaptado, 150) },
                  { width: '*', text: r.captado, fontSize: 9, bold: true, alignment: 'right', margin: [0, 1, 0, 0] },
                ],
                columnGap: 8,
              },
            ],
          },
        ],
        columnGap: 20,
        margin: [0, 6, 0, 20],
      },
      {
        columns: [
          { stack: [{ text: 'Aporte da Enap', fontSize: 8, color: TINTA2 }, { text: r.aporte, fontSize: 11, bold: true }] },
          { stack: [{ text: 'Captado', fontSize: 8, color: TINTA2 }, { text: r.captado, fontSize: 11, bold: true }] },
          { stack: [{ text: 'Retorno líquido', fontSize: 8, color: TINTA2 }, { text: r.liquido, fontSize: 11, bold: true }] },
          { stack: [{ text: 'ROI', fontSize: 8, color: TINTA2 }, { text: r.roi, fontSize: 11, bold: true }] },
        ],
        columnGap: 14,
        margin: [0, 0, 0, 18],
      },
      { text: 'Captação ano a ano', fontSize: 11, bold: true, margin: [0, 0, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: [70, '*', '*', '*', 80],
          body: [
            ['Ano', 'Aporte', 'Meta de captação', 'Captado', 'Proporção'].map((t, i) => ({
              text: t,
              fontSize: 8,
              bold: true,
              color: TINTA2,
              alignment: i === 0 || i === 4 ? 'left' : 'right',
            })),
            ...m.captacaoPorAno.map((a) => [
              { text: a.ano, fontSize: 8.5 },
              { text: a.aporte, fontSize: 8.5, alignment: 'right' },
              { text: a.meta, fontSize: 8.5, alignment: 'right' },
              { text: a.realizado, fontSize: 8.5, alignment: 'right' },
              barra(a.preenchimento, 74, a.referencia),
            ]),
          ],
        },
        layout: layoutTabela,
      },
    );

    if (m.projecoes) {
      conteudo.push(
        { text: 'Projeção de novos aportes', fontSize: 11, bold: true, margin: [0, 18, 0, 4] },
        {
          text: `Aplica a alavancagem já observada — ${m.projecoes.acumulada} por R$ 1,00 no acumulado, e de ${m.projecoes.faixa} entre os anos isolados. É projeção, não compromisso.`,
          fontSize: 8,
          color: TINTA2,
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*'],
            body: [
              ['Novo aporte', 'Captação projetada', 'Faixa observada'].map((t, i) => ({
                text: t,
                fontSize: 8,
                bold: true,
                color: TINTA2,
                alignment: i === 0 ? 'left' : 'right',
              })),
              ...m.projecoes.cenarios.map((c) => [
                { text: c.aporte, fontSize: 8.5 },
                { text: c.central, fontSize: 8.5, alignment: 'right' },
                { text: `${c.minimo} a ${c.maximo}`, fontSize: 8.5, alignment: 'right' },
              ]),
            ],
          },
          layout: layoutTabela,
        },
      );
    }

    if (m.escala) {
      conteudo.push({
        text: `Escala potencial: ${m.escala.meta} desafios contratados até 2028 dentro de um alcance projetado de ${m.escala.projecao} — ${m.escala.multiplo}× a meta.`,
        fontSize: 8.5,
        color: TINTA2,
        margin: [0, 16, 0, 0],
      });
    }
  }

  // ------------------------------------------------------ 04 território ----
  if (m.territorio) {
    const t = m.territorio;
    conteudo.push(
      ...cabecalhoSecao('04', 'Impacto territorial', 'Onde a parceria chegou: estados, organizações e municípios do recorte.'),
      {
        columns: [
          { width: 200, svg: t.mapaSvg },
          {
            width: '*',
            stack: [
              { text: 'Estados alcançados', fontSize: 8, color: TINTA2 },
              { text: `${t.ufsAlcancadas} de ${t.totalUfs}`, fontSize: 13, bold: true, margin: [0, 2, 0, 10] },
              { text: 'Organizações públicas', fontSize: 8, color: TINTA2 },
              { text: String(t.organizacoes), fontSize: 13, bold: true, margin: [0, 2, 0, 1] },
              { text: t.niveis, fontSize: 7.5, color: TINTA2, margin: [0, 0, 0, 10] },
              { text: 'Agentes públicos', fontSize: 8, color: TINTA2 },
              { text: String(t.agentes), fontSize: 13, bold: true, margin: [0, 2, 0, 1] },
              { text: `em ${t.instituicoes} organizações`, fontSize: 7.5, color: TINTA2, margin: [0, 0, 0, 10] },
              { text: 'Municípios com projeto', fontSize: 8, color: TINTA2 },
              { text: String(t.totalMunicipios), fontSize: 13, bold: true, margin: [0, 2, 0, 1] },
              { text: t.municipios, fontSize: 7.5, color: TINTA2 },
            ],
          },
        ],
        columnGap: 24,
        margin: [0, 4, 0, 18],
      },
      { text: 'Frentes por estado', fontSize: 11, bold: true, margin: [0, 0, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: [22, 96, 38, '*'],
          body: [
            ['UF', 'Estado', 'Frentes', 'Iniciativas e prefeituras com agentes'].map((t2, i) => ({
              text: t2,
              fontSize: 8,
              bold: true,
              color: TINTA2,
              alignment: i === 2 ? 'right' : 'left',
            })),
            ...t.estados.map((e) => [
              { text: e.uf, fontSize: 8.5, bold: true },
              { text: e.nome, fontSize: 8.5 },
              { text: String(e.frentes), fontSize: 8.5, alignment: 'right' },
              { text: e.iniciativas, fontSize: 7.5, color: TINTA2 },
            ]),
          ],
        },
        layout: layoutTabela,
      },
      { text: 'Organizações por agentes engajados', fontSize: 11, bold: true, margin: [0, 18, 0, 8] },
      ...t.ranking.map((o) => ({
        columns: [
          { text: o.nome, fontSize: 8.5 },
          { width: 110, ...barra(o.preenchimento, 110) },
          { width: 22, text: String(o.agentes), fontSize: 8.5, bold: true, alignment: 'right' },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 6],
      })),
    );
  }

  // ----------------------------------------------------------- 05 notas ----
  conteudo.push(
    ...cabecalhoSecao('05', 'Notas metodológicas', 'Como cada número deste relatório foi construído.'),
    ...m.notas.flatMap((n) => [
      { text: n.titulo, fontSize: 10, bold: true, margin: [0, 10, 0, 2] },
      { text: n.texto, fontSize: 8.5, color: TINTA2, lineHeight: 1.25 },
    ]),
  );

  const definicao = {
    info: {
      title: `Relatório executivo — Parceria Enap × Impact Hub Brasil`,
      subject: m.recorte,
      creator: 'Painel da Parceria Enap × Impact Hub Brasil',
    },
    pageSize: 'A4',
    pageMargins: [40, 44, 40, 46],
    defaultStyle: { font: 'Helvetica', fontSize: 9, color: TINTA, lineHeight: 1.2 },
    footer: (paginaAtual: number, totalPaginas: number) => ({
      columns: [
        {
          text: `Painel da Parceria Enap × Impact Hub Brasil · ${m.recorte} · ${data}`,
          fontSize: 7,
          color: TINTA2,
        },
        {
          text: `${paginaAtual}/${totalPaginas}`,
          fontSize: 7,
          color: TINTA2,
          alignment: 'right',
          width: 40,
        },
      ],
      margin: [40, 12, 40, 0],
    }),
    content: conteudo,
  };

  pdfMake.createPdf(definicao).download(nomeDoArquivo(m));
}

/** Nome pronto, com o recorte embutido: nada de "documento (3).pdf". */
export function nomeDoArquivo(m: ModeloRelatorio): string {
  const data = m.emitidoEm.toISOString().slice(0, 10);
  const recorte = m.recorte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  return `Relatorio-Enap-ImpactHub-${recorte}-${data}.pdf`;
}
