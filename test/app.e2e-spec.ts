import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/ (GET)', () => {
    it('should return API welcome message', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            message: 'Welcome to the BDGAD EMR API',
            version: '1.0.0',
            documentation: 'https://docs.bdgad-emr.com',
          });
        });
    });

    it('should return JSON content-type', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Content-Type', /json/);
    });
  });

  describe('Health Check Endpoints', () => {
    it('should handle 404 for non-existent routes', () => {
      return request(app.getHttpServer())
        .get('/non-existent-route')
        .expect(404);
    });

    it('should handle OPTIONS requests', () => {
      return request(app.getHttpServer()).options('/').expect(200);
    });
  });

  describe('API Structure', () => {
    it('should have patient endpoints available', () => {
      return request(app.getHttpServer())
        .get('/patient/search')
        .expect((res) => {
          // Expecting 401 (Unauthorized) since no auth token provided
          expect([401, 403]).toContain(res.status);
        });
    });

    it('should have pharmacy endpoints available', () => {
      return request(app.getHttpServer())
        .post('/pharmacy/send-queue')
        .expect(201);
    });

    it('should handle CORS preflight requests', () => {
      return request(app.getHttpServer())
        .options('/patient/search')
        .expect(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', () => {
      return request(app.getHttpServer())
        .post('/pharmacy/send-queue')
        .send('{"malformed": json}')
        .set('Content-Type', 'application/json')
        .expect(400);
    });

    it('should handle invalid HTTP methods', () => {
      return request(app.getHttpServer()).patch('/').expect(404);
    });

    it('should handle large request bodies appropriately', () => {
      const largeBody = {
        data: 'x'.repeat(1000000), // 1MB string
      };

      return request(app.getHttpServer())
        .post('/pharmacy/send-queue')
        .send(largeBody)
        .expect((res) => {
          // Should either succeed or return payload too large
          expect([201, 413]).toContain(res.status);
        });
    });
  });

  describe('Security Headers', () => {
    it('should not expose sensitive headers', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.headers['x-powered-by']).toBeUndefined();
        });
    });
  });

  describe('Performance', () => {
    it('should respond to root endpoint within reasonable time', () => {
      const start = Date.now();

      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect(() => {
          const duration = Date.now() - start;
          expect(duration).toBeLessThan(1000); // Should respond within 1 second
        });
    });
  });

  describe('Content Negotiation', () => {
    it('should accept JSON content type', () => {
      return request(app.getHttpServer())
        .post('/pharmacy/send-queue')
        .set('Content-Type', 'application/json')
        .send({})
        .expect(201);
    });

    it('should handle missing content-type header', () => {
      return request(app.getHttpServer())
        .post('/pharmacy/send-queue')
        .send({})
        .expect(201);
    });
  });

  describe('API Versioning', () => {
    it('should include version in response', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect((res) => {
          expect(res.body.version).toBeDefined();
          expect(typeof res.body.version).toBe('string');
        });
    });
  });
});
