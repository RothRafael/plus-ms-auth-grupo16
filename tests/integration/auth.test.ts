import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { faker } from '@faker-js/faker';
import { createTestUser, generateAuthHeader } from '../helpers/auth.helper';

describe('Authentication Integration Tests', () => {
  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: faker.internet.email(),
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Usuário registrado com sucesso');
      expect(response.body.data.user).toHaveProperty('email', userData.email.toLowerCase());
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should fail to register with an existing email', async () => {
      const user = await createTestUser();
      
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: user.email,
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email já registrado');
    });

    it('should fail with invalid email format', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Formato de email inválido');
    });

    it('should fail with short password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: faker.internet.email(),
          password: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'A senha deve ter pelo menos 6 caracteres');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const password = 'securePassword123';
      const user = await createTestUser({ password });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: user.email,
          password: password
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login realizado com sucesso');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user).toHaveProperty('id', user.id);
    });

    it('should fail login with incorrect password', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: user.email,
          password: 'wrongPassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Credenciais inválidas ou usuário inativo');
    });

    it('should fail login for non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anyPassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Credenciais inválidas ou usuário inativo');
    });
  });

  describe('GET /auth/me', () => {
    it('should return user data for a valid token', async () => {
      const user = await createTestUser();
      const authHeader = generateAuthHeader(user.id, user.email, user.role);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('userId', user.id);
      expect(response.body.data).toHaveProperty('email', user.email);
    });

    it('should fail if no token is provided', async () => {
      const response = await request(app).get('/auth/me');
      expect(response.status).toBe(401);
    });

    it('should fail with an invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should issue a new access token with a valid refresh token', async () => {
      const user = await createTestUser();
      
      // Get initial refresh token via login
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({ email: user.email, password: user.plainPassword });
      
      const refreshToken = loginResponse.body.data.refreshToken;

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('accessToken');
    });

    it('should fail with an invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully and invalidate the access token', async () => {
      const user = await createTestUser();
      
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({ email: user.email, password: user.plainPassword });
      
      const { accessToken } = loginResponse.body.data;
      const authHeader = `Bearer ${accessToken}`;

      // Logout
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Authorization', authHeader);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body).toHaveProperty('message', 'Logout realizado com sucesso');

      // Try to use the same token again
      const meResponse = await request(app)
        .get('/auth/me')
        .set('Authorization', authHeader);

      expect(meResponse.status).toBe(401);
      expect(meResponse.body).toHaveProperty('error', 'Token revogado');
    });
  });
});
