import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { CanonicalErrorFilter } from "../src/common/filters/canonical-error.filter";
import * as request from "supertest";
import { AppModule } from "../src/modules/app/app.module";

describe("Contracts POST (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new CanonicalErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /contracts returns 400 for invalid contract json", async () => {
    const res = await request(app.getHttpServer())
      .post("/contracts")
      .send({ json: {}, version: "1.0.0", meta: {} })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "BAD_REQUEST");
    expect(res.body.error).toHaveProperty("message", "Invalid contract json");
    // Details should include the original payload with errors list
    expect(res.body.error.details).toHaveProperty("errors");
    const errors = res.body.error.details.errors as string[];
    expect(Array.isArray(errors)).toBe(true);
    expect(
      errors.some((m) =>
        m.includes("meta: Required section missing or invalid")
      )
    ).toBe(true);
    expect(
      errors.some((m) =>
        m.includes("pagesUI: Required section missing or invalid")
      )
    ).toBe(true);
  });

  it("POST /users/:id/contract returns 400 for invalid version", async () => {
    const res = await request(app.getHttpServer())
      .post("/users/507f1f77bcf86cd799439011/contract")
      .send({
        json: { meta: {}, pagesUI: { pages: {} } },
        version: "v1",
        meta: {},
      })
      .expect(400);

    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "BAD_REQUEST");
    expect(res.body.error).toHaveProperty(
      "message",
      "version must be semver string like 1.0.0"
    );
  });
});