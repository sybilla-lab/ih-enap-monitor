export interface NavItem {
  label: string;
  /** Complemento do nome, exibido como segunda linha no menu. */
  descricao?: string;
  icon: string;
  route: string;
}

// Fonte única dos itens do menu lateral. A ordem é a da leitura pretendida:
// panorama, progresso consolidado, cada linha de ação, alcance e o documento.
// Nomes longos ficam em duas linhas (rótulo + descrição) em vez de truncados.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', icon: 'home', route: '/home' },
  { label: 'Progresso das Metas', icon: 'track_changes', route: '/progresso' },
  {
    label: 'Linha I',
    descricao: 'Projetos de inovação aberta',
    icon: 'lightbulb',
    route: '/linha-i',
  },
  {
    label: 'Linha II',
    descricao: 'Aceleração e Incubação',
    icon: 'rocket_launch',
    route: '/linha-ii',
  },
  {
    label: 'Linha III',
    descricao: 'Cultura, conhecimento e comunidades',
    icon: 'groups',
    route: '/linha-iii',
  },
  {
    label: 'Linha IV',
    descricao: 'Prospecção e Retorno da Parceria',
    icon: 'trending_up',
    route: '/linha-iv',
  },
  { label: 'Impacto Territorial', icon: 'public', route: '/territorio' },
  { label: 'Relatório Executivo', icon: 'description', route: '/relatorio' },
];
