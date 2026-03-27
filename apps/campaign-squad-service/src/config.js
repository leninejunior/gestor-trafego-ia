const dotenv = require('dotenv');

dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 4010),
  internalSecret: (process.env.CAMPAIGN_SQUAD_INTERNAL_SECRET || '').trim(),
  redisUrl: (process.env.REDIS_URL || '').trim(),
  appDashboardUrl: (process.env.APP_DASHBOARD_URL || 'http://localhost:3000/dashboard/campaign-squad').trim(),
  evolutionApiUrl: (process.env.EVOLUTION_API_URL || '').trim(),
  evolutionApiKey: (process.env.EVOLUTION_API_KEY || '').trim(),
  evolutionInstanceName: (process.env.EVOLUTION_INSTANCE_NAME || '').trim()
};

