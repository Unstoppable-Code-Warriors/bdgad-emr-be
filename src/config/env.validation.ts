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
});
