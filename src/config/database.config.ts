import { registerAs } from '@nestjs/config';

export default registerAs(
  'database',
  (): Record<string, any> => {
    const baseUrl = process.env.MONGO_URL ?? '';
    const dbName = process.env.MONGO_DATABASE_NAME;
    // Append DB name only if base URL has no existing path component
    let uri = baseUrl;
    try {
      const parsed = new URL(baseUrl);
      const hasPath = !!parsed.pathname && parsed.pathname !== '/';
      if (dbName && !hasPath) {
        parsed.pathname = `/${dbName}`;
        uri = parsed.toString();
      }
    } catch (_e) {
      // Fallback: naive append if no slash exists and dbName provided
      if (dbName && baseUrl && !baseUrl.includes('/')) {
        uri = `${baseUrl}/${dbName}`;
      }
    }
    return { uri };
  },
);
