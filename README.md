# Painel da Parceria Enap × Impact Hub Brasil

Dashboard de acompanhamento do Programa de Parceria Enap × Impact Hub Brasil (2024–2028):
cumprimento das metas por linha de ação, retorno do investimento e alcance territorial.

**Publicado em https://sybilla-lab.github.io/ih-enap-monitor/** — abre na tela de carga, porque o
site não traz dado nenhum: quem abre é que fornece a planilha.

> **Este repositório não contém dados.** Os indicadores da parceria são confidenciais e nunca
> foram versionados aqui. O painel lê a planilha oficial no navegador de quem o abre — o arquivo
> não é enviado a servidor nenhum e não fica no repositório. Enquanto não existir um backend com
> controle de acesso, é assim que o código pode ser público sem que os dados sejam.

## Como rodar

Requer **Node 22.11+**.

```bash
cd dashboard
npm install
npm start
```

Abra `http://localhost:4200`. A primeira tela pede a **Planilha Oficial de Indicadores** (`.xlsx`):
arraste o arquivo ou clique para escolher. A partir daí o painel funciona normalmente.

Os dados ficam apenas na aba do navegador (`sessionStorage`): sobrevivem a um F5 e somem quando a
aba é fechada. O botão ↔ na barra superior troca a planilha em uso.

> `npm install` baixa o `xlsx` do CDN oficial da SheetJS (`cdn.sheetjs.com`), e não do npm — a
> versão publicada no npm está desatualizada e com vulnerabilidades conhecidas. É preciso ter
> acesso a esse domínio.

## O que a planilha precisa ter

A leitura localiza cada aba pelo nome e cada coluna pelo texto do cabeçalho, então mudanças de
posição (linhas ou colunas em branco a mais) não quebram o painel.

| Aba | O que alimenta |
|---|---|
| `Metas` | indicadores por linha de ação, metas e realizados de 2024 a 2028 |
| `Parceria` | aportes anuais, valor captado, ROI, meta global de desafios |
| `Linha I Desafios` · `Linha II Aceleracao` | alcance por estado (coluna `ESTADOS`) |
| `LI - Agentes Públicos` | agentes públicos engajados, por instituição e ano |
| `LIV - Organizações públicas` | organizações engajadas, nível federativo e ano |

Só `Metas` e `Parceria` são obrigatórias; sem as demais, a página de Impacto Territorial fica
vazia. **Nome e e-mail das pessoas não são lidos** — o painel conta agentes, não os identifica.

## Estrutura

```
dashboard/src/app/
├── core/
│   ├── data/planilha.ts        leitura do .xlsx (único lugar que conhece o formato)
│   ├── services/               origem dos dados, filtro global, tema
│   ├── models/                 indicadores e território
│   └── util/                   números, cores e agregações
├── features/
│   ├── carregar/               tela de carga da planilha
│   ├── home/                   visão executiva e avanço rumo a 2028
│   ├── retorno/                alavancagem, captação e simulador
│   ├── territorio/             cartograma, organizações e detalhe por estado
│   └── relatorio/              relatório executivo em documento, para virar PDF
├── shared/components/          dock de filtros e stat tile
└── layout/                     itens do menu
```

Angular 19 (standalone + signals), Angular Material M3 com paleta derivada da marca, Chart.js.

## Relatório em PDF

A página **Relatório Executivo** monta um documento com tudo o que as demais telas mostram —
tabela completa de indicadores, avanço rumo a 2028, retorno e alavancagem, frentes por estado com
as iniciativas nomeadas e notas metodológicas — respeitando o recorte do filtro. O botão *Gerar
PDF* abre a impressão do navegador; escolha "Salvar como PDF" e desmarque "Cabeçalhos e rodapés".

O PDF sai em A4 com texto selecionável e gráficos vetoriais (nenhuma captura de tela): os gráficos
do relatório são SVG desenhados a partir dos mesmos dados, e não o canvas das telas interativas.

## Publicação

Todo push na `main` dispara o workflow `.github/workflows/deploy.yml`, que builda com
`--base-href=/ih-enap-monitor/` e publica no GitHub Pages. O `index.html` também é servido como
`404.html` para que links diretos e F5 em `/retorno` e `/territorio` funcionem — o Pages não
conhece o roteador do Angular e devolveria 404 nessas rotas.

## Próximo passo

Trocar o upload por uma API. As páginas consomem apenas os signals de `DataService` e não sabem de
onde vêm os dados: a API preenche o mesmo `aplicar()` e a condição no `app.component.html` deixa de
exigir a tela de carga. Nada mais precisa mudar.
