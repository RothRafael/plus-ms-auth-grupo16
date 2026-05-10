import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Health Check Smoke Test', () => {
  it('should return 200 OK from /health', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'OK');
  });
});
