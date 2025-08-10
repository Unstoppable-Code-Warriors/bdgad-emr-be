import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Server configuration
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(4000),

  // ClickHouse configuration
  CLICKHOUSE_HOST: Joi.string().required(),
  CLICKHOUSE_PORT: Joi.number().default(8123),
  CLICKHOUSE_USERNAME: Joi.string().required(),
  CLICKHOUSE_PASSWORD: Joi.string().required(),
  CLICKHOUSE_DATABASE: Joi.string().required(),
  CLICKHOUSE_PROTOCOL: Joi.string().valid('http', 'https').default('http'),

  // RabbitMQ configuration
  RABBITMQ_URL: Joi.string().required(),

  // OpenAI configuration
  OPENAI_API_URL: Joi.string().default('https://api.openai.com/v1'),
  OPENAI_API_KEY: Joi.string().required(),

  // AI Chat configuration
  SYSTEM_PROMPT: Joi.string().optional(),

  // S3/Cloudflare R2 configuration
  S3_ENDPOINT: Joi.string().required(),
  S3_ACCESS_KEY_ID: Joi.string().required(),
  S3_SECRET_ACCESS_KEY: Joi.string().required(),
});
