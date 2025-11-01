import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/modules/app/app.module';
import { ContractService } from '../src/modules/contract/services/contract.service';
import { Types as MongooseTypes } from 'mongoose';

describe('Contracts (e2e)', () => {
  let app: INestApplication;

  const canonicalDoc = {
    _id: new MongooseTypes.ObjectId('507f1f77bcf86cd799439011'),
    version: '1.0.0',
    json: {
      meta: { appName: 'Demo App' },
      pagesUI: { pages: { home: { id: 'home', title: 'Home' } } },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    meta: { source: 'test' },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ContractService)
      .useValue({
        findLatestCanonical: jest.fn().mockResolvedValue(canonicalDoc),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /contracts/canonical (public) returns latest canonical contract', async () => {
    const res = await request(app.getHttpServer())
      .get('/contracts/canonical')
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body).toHaveProperty('json');
    expect(res.body).toHaveProperty('version', '1.0.0');
    expect(res.body).toHaveProperty('id');
    // Cache header must be present for canonical route
    expect(res.header['cache-control']).toBe('public, max-age=300');
  });

  it('GET /contracts/public/canonical (alias) returns latest canonical contract', async () => {
    const res = await request(app.getHttpServer())
      .get('/contracts/public/canonical')
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body).toHaveProperty('json');
    expect(res.body).toHaveProperty('version', '1.0.0');
    expect(res.body).toHaveProperty('id');
    // Alias should have same caching header
    expect(res.header['cache-control']).toBe('public, max-age=300');

    // Bodies should be identical to canonical
    const canonicalRes = await request(app.getHttpServer())
      .get('/contracts/canonical')
      .expect(200);
    expect(JSON.stringify(res.body)).toBe(JSON.stringify(canonicalRes.body));
  });

  it('GET /contracts/:id requires JWT (protected)', async () => {
    await request(app.getHttpServer())
      .get('/contracts/507f1f77bcf86cd799439011')
      .expect(401);
  });
});