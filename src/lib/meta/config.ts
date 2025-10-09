// Configuração para Meta Marketing API
export const META_CONFIG = {
  APP_ID: process.env.META_APP_ID!,
  APP_SECRET: process.env.META_APP_SECRET!,
  ACCESS_TOKEN: process.env.META_ACCESS_TOKEN!,
  API_VERSION: 'v21.0',
  BASE_URL: 'https://graph.facebook.com',
} as const;

export const META_SCOPES = [
  'ads_management',
  'ads_read',
  'business_management',
  'pages_read_engagement',
  'pages_show_list',
] as const;

export const META_OAUTH_URL = `https://www.facebook.com/v21.0/dialog/oauth`;