/**
 * Traduções para objetivos de campanhas do Meta Ads
 */

export const META_OBJECTIVE_LABELS: Record<string, string> = {
  // Objetivos legados
  'APP_INSTALLS': 'Instalações de App',
  'BRAND_AWARENESS': 'Reconhecimento de Marca',
  'CONVERSIONS': 'Conversões',
  'EVENT_RESPONSES': 'Respostas a Eventos',
  'LEAD_GENERATION': 'Geração de Leads',
  'LINK_CLICKS': 'Cliques no Link',
  'LOCAL_AWARENESS': 'Reconhecimento Local',
  'MESSAGES': 'Mensagens',
  'OFFER_CLAIMS': 'Reivindicações de Ofertas',
  'PAGE_LIKES': 'Curtidas na Página',
  'POST_ENGAGEMENT': 'Engajamento com Publicação',
  'PRODUCT_CATALOG_SALES': 'Vendas do Catálogo',
  'REACH': 'Alcance',
  'STORE_VISITS': 'Visitas à Loja',
  'VIDEO_VIEWS': 'Visualizações de Vídeo',
  
  // Novos objetivos (Outcome-based)
  'OUTCOME_APP_PROMOTION': 'Promoção de App',
  'OUTCOME_AWARENESS': 'Reconhecimento',
  'OUTCOME_ENGAGEMENT': 'Engajamento',
  'OUTCOME_LEADS': 'Leads',
  'OUTCOME_SALES': 'Vendas',
  'OUTCOME_TRAFFIC': 'Tráfego',
};

/**
 * Traduz o objetivo da campanha para português
 * @param objective - Objetivo em inglês da API do Meta
 * @returns Objetivo traduzido ou o valor original se não houver tradução
 */
export function translateMetaObjective(objective: string): string {
  return META_OBJECTIVE_LABELS[objective] || objective;
}

/**
 * Traduz o status da campanha para português
 */
export const META_STATUS_LABELS: Record<string, string> = {
  'ACTIVE': 'Ativa',
  'PAUSED': 'Pausada',
  'DELETED': 'Excluída',
  'ARCHIVED': 'Arquivada',
  'IN_PROCESS': 'Em Processamento',
  'WITH_ISSUES': 'Com Problemas',
};

/**
 * Traduz o status da campanha para português
 * @param status - Status em inglês da API do Meta
 * @returns Status traduzido ou o valor original se não houver tradução
 */
export function translateMetaStatus(status: string): string {
  return META_STATUS_LABELS[status] || status;
}

/**
 * Retorna todos os objetivos disponíveis traduzidos
 */
export function getAllMetaObjectives(): Array<{ value: string; label: string }> {
  return Object.entries(META_OBJECTIVE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
}
