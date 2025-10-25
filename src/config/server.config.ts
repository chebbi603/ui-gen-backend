import { registerAs } from '@nestjs/config';

export default registerAs(
  'server',
  (): Record<string, any> => ({
    port: `${process.env.PORT}`,
    rabbitMqBroker: {
      uri: `${process.env.RABBITMQ_URL}`,
      topic: `${process.env.RABBITMQ_TOPIC}`,
    },
  }),
);
