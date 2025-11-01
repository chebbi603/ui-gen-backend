import { registerAs } from '@nestjs/config';

export default registerAs(
  'database',
  (): Record<string, any> => {
    const baseUrl = process.env.MONGO_URL ?? '';
    const dbName = process.env.MONGO_DATABASE_NAME;
    // If a DB name is provided, append it; otherwise use the base URL as-is
    const uri = dbName ? `${baseUrl}/${dbName}` : baseUrl;
    return { uri };
  },
);
