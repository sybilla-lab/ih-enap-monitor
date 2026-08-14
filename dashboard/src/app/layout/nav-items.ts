export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

// Fonte única dos itens do menu lateral. Novas páginas (Metas e Indicadores,
// Linha I-IV, Comunicação, Impacto Territorial, etc.) entram aqui conforme
// forem implementadas — o template do shell não precisa mudar.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', icon: 'home', route: '/home' },
  { label: 'Retorno da Parceria', icon: 'trending_up', route: '/retorno' },
  { label: 'Impacto Territorial', icon: 'public', route: '/territorio' },
  { label: 'Relatório Executivo', icon: 'description', route: '/relatorio' },
];
