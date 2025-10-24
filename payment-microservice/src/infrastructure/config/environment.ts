import * as dotenv from 'dotenv';
import * as Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  
  // Database
  DATABASE_URL: Joi.string().required(),
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_SSL: Joi.boolean().default(false),
  
  // Redis
  REDIS_URL: Joi.string().required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional(),
  
  // Security
  ENCRYPTION_KEY: Joi.string().min(32).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  
  // Monitoring
  METRICS_PORT: Joi.number().default(9090),
  HEALTH_CHECK_INTERVAL: Joi.number().default(30000),
  
  // Provider Configurations
  STRIPE_SECRET_KEY: Joi.string().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
  IUGU_API_TOKEN: Joi.string().optional(),
  PAGSEGURO_EMAIL: Joi.string().optional(),
  PAGSEGURO_TOKEN: Joi.string().optional(),
  MERCADOPAGO_ACCESS_TOKEN: Joi.string().optional(),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  database: {
    url: envVars.DATABASE_URL,
    host: envVars.DATABASE_HOST,
    port: envVars.DATABASE_PORT,
    name: envVars.DATABASE_NAME,
    user: envVars.DATABASE_USER,
    password: envVars.DATABASE_PASSWORD,
    ssl: envVars.DATABASE_SSL,
  },
  
  redis: {
    url: envVars.REDIS_URL,
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
  },
  
  security: {
    encryptionKey: envVars.ENCRYPTION_KEY,
    jwtSecret: envVars.JWT_SECRET,
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
  },
  
  monitoring: {
    metricsPort: envVars.METRICS_PORT,
    healthCheckInterval: envVars.HEALTH_CHECK_INTERVAL,
  },
  
  providers: {
    stripe: {
      secretKey: envVars.STRIPE_SECRET_KEY,
      webhookSecret: envVars.STRIPE_WEBHOOK_SECRET,
    },
    iugu: {
      apiToken: envVars.IUGU_API_TOKEN,
    },
    pagseguro: {
      email: envVars.PAGSEGURO_EMAIL,
      token: envVars.PAGSEGURO_TOKEN,
    },
    mercadopago: {
      accessToken: envVars.MERCADOPAGO_ACCESS_TOKEN,
    },
  },
};