import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { Redis } from 'ioredis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private initializing = false;

  constructor(private readonly config: ConfigService) {}

  private async ensureClient(): Promise<Redis | null> {
    if (this.client) return this.client;
    if (this.initializing) {
      // small delay for parallel callers
      await new Promise((r) => setTimeout(r, 10));
      return this.client;
    }
    this.initializing = true;
    try {
      const redisUrl = this.config.get<string>('redis.url');
      const host = this.config.get<string>('redis.host');
      const port = this.config.get<number>('redis.port');
      const password = this.config.get<string>('redis.password');
      const db = this.config.get<number>('redis.db');
      const commonOpts: any = {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: () => null,
        reconnectOnError: () => false,
      };
      const client = redisUrl
        ? new IORedis(redisUrl, commonOpts)
        : new IORedis({ host, port, password, db, ...commonOpts });
      client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err?.message || err}`);
      });
      await (client as any).connect?.().catch(() => {});
      this.client = client;
      return this.client;
    } catch (e) {
      this.logger.warn('Redis not available; caching disabled');
      this.client = null;
      return null;
    } finally {
      this.initializing = false;
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const client = await this.ensureClient();
    if (!client) return null;
    try {
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const client = await this.ensureClient();
    if (!client) return;
    try {
      const payload = JSON.stringify(value);
      await client.set(key, payload, 'EX', ttlSeconds);
    } catch {
      // swallow
    }
  }

  async del(key: string): Promise<void> {
    const client = await this.ensureClient();
    if (!client) return;
    try {
      await client.del(key);
    } catch {
      // swallow
    }
  }
}