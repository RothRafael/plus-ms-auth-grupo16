import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { createTestUser, generateAuthHeader } from '../helpers/auth.helper';

describe('RBAC Integration Tests', () => {
  describe('Admin Only Routes', () => {
    it('should allow admin to list users', async () => {
      const admin = await createTestUser({ role: 'admin' });
      const authHeader = generateAuthHeader(admin.id, admin.email, admin.role);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Lista de usuários recuperada com sucesso');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should deny non-admin user from listing users', async () => {
      const user = await createTestUser({ role: 'vendedor' });
      const authHeader = generateAuthHeader(user.id, user.email, user.role);

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', authHeader);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Acesso negado: permissão insuficiente');
    });
  });

  describe('Owner or Admin Access (ownerOnly)', () => {
    it('should allow a user to see their own profile', async () => {
      const user = await createTestUser();
      const authHeader = generateAuthHeader(user.id, user.email, user.role);

      const response = await request(app)
        .get(`/api/users/${user.id}`)
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id', user.id);
    });

    it('should allow an admin to see any user profile', async () => {
      const user = await createTestUser();
      const admin = await createTestUser({ role: 'admin' });
      const authHeader = generateAuthHeader(admin.id, admin.email, admin.role);

      const response = await request(app)
        .get(`/api/users/${user.id}`)
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id', user.id);
    });

    it('should deny a user from seeing another user profile', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const authHeader1 = generateAuthHeader(user1.id, user1.email, user1.role);

      const response = await request(app)
        .get(`/api/users/${user2.id}`)
        .set('Authorization', authHeader1);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Acesso negado: apenas o dono ou admin pode acessar');
    });
  });

  describe('Admin Stats', () => {
    it('should allow admin to see stats', async () => {
      const admin = await createTestUser({ role: 'admin' });
      const authHeader = generateAuthHeader(admin.id, admin.email, admin.role);

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('activeUsers');
    });

    it('should deny gestor from seeing admin stats', async () => {
      const moderator = await createTestUser({ role: 'gestor' });
      const authHeader = generateAuthHeader(moderator.id, moderator.email, moderator.role);

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', authHeader);

      expect(response.status).toBe(403);
    });
  });
});
