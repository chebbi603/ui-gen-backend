import { Injectable } from '@nestjs/common';
import { ContractService } from '../../contract/services/contract.service';
import { EventService } from '../../event/services/event.service';

@Injectable()
export class LlmService {
  constructor(
    private readonly contractService: ContractService,
    private readonly eventService: EventService,
  ) {}

  async generateOptimizedContract(params: {
    userId: string;
    baseContract?: Record<string, unknown>;
    version?: string;
  }): Promise<{ version: string; json: Record<string, unknown> }> {
    const { userId, baseContract, version } = params;
    const events = await this.eventService.listByUser(userId, 'ADMIN', userId);

    // Simple heuristic: include counts per eventType into contract meta
    const counts = events.reduce<Record<string, number>>((acc, e) => {
      acc[e.eventType] = (acc[e.eventType] || 0) + 1;
      return acc;
    }, {});

    const current =
      baseContract ||
      (await this.contractService.findLatestByUser(userId))?.json ||
      {};

    const optimized: Record<string, unknown> = {
      ...current,
      analytics: { eventCounts: counts },
    };

    // Bump patch version or default to 0.1.0
    const nextVersion = bumpPatch(
      version ||
        ((await this.contractService.findLatestByUser(userId))?.version ??
          '0.1.0'),
    );

    return { version: nextVersion, json: optimized };
  }
}

function bumpPatch(v: string): string {
  const [major, minor, patch] = v.split('.').map((x) => parseInt(x, 10));
  if ([major, minor, patch].some((n) => Number.isNaN(n))) return '0.1.0';
  return `${major}.${minor}.${patch + 1}`;
}
