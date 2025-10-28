import { registerAs } from '@nestjs/config';

export default registerAs(
  'server',
  (): Record<string, any> => ({
    port: (() => {
      const isProd = (process.env.NODE_ENV || 'development') === 'production';
      const envPort = process.env.PORT;
      if (envPort) return envPort;
      return isProd ? undefined : '8081';
    })(),
    rabbitMqBroker: {
      uri: `${process.env.RABBITMQ_URL}`,
      topic: `${process.env.RABBITMQ_TOPIC}`,
    },
  }),
);
