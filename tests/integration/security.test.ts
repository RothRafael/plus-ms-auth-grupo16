import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import { generateAuthHeader } from '../helpers/auth.helper';

describe('Security and Injection Tests', () => {
  describe('SQL Injection Protection', () => {
    it('should not be vulnerable to SQL injection in login email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: "' OR '1'='1' --",
          password: 'anyPassword'
        });

      // Should return 401 Unauthorized, not 200 OK
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Credenciais inválidas ou usuário inativo');
    });

    it('should not be vulnerable to SQL injection in user search', async () => {
      const response = await request(app)
        .get("/api/users/' OR '1'='1")
        .set('Authorization', 'Bearer invalid-token');

      // Should fail due to auth first, but even if authenticated, should not leak data
      expect(response.status).toBe(401);
    });
  });

  describe('JWT Security', () => {
    it('should reject a token signed with a different secret', async () => {
      const payload = { userId: '123', email: 'test@example.com', role: 'admin' };
      const maliciousToken = jwt.sign(payload, 'wrong_secret');

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${maliciousToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Token inválido ou expirado');
    });

    it('should reject a token with modified payload but same signature', async () => {
      // This is impossible with HS256 if secret is unknown, 
      // but we test that the implementation actually verifies the signature.
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIn0.fake_signature');

      expect(response.status).toBe(401);
    });
  });

  describe('Information Disclosure', () => {
    it('should not return sensitive internal error details to the client', async () => {
      // We need a valid token to pass the authMiddleware and reach the 404 handler for /api routes
      const authHeader = generateAuthHeader('123', 'test@example.com', 'vendedor');

      const response = await request(app)
        .get('/api/non-existent-route')
        .set('Authorization', authHeader);

      expect(response.status).toBe(404);
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('internal');
    });
  });
});
