import { registerAs } from '@nestjs/config';

export default registerAs(
  'database',
  (): Record<string, any> => ({
    uri: `${process.env.MONGO_URL}/${process.env.MONGO_DATABASE_NAME}`,
  }),
);
