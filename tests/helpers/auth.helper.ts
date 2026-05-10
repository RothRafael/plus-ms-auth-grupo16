import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import db from '../../src/config/database';
import jwtService from '../../src/services/jwt.service';
import { Role } from '../../src/types';

export const createTestUser = async (overrides: { email?: string; password?: string; role?: Role } = {}) => {
  const email = (overrides.email || faker.internet.email()).toLowerCase();
  const password = overrides.password || 'password123';
  const role = overrides.role || 'user';
  
  const passwordHash = await bcrypt.hash(password, 10);
  
  const query = `
    INSERT INTO users (email, password, role)
    VALUES ($1, $2, $3)
    RETURNING id, email, role, is_active;
  `;
  
  const { rows } = await db.query(query, [email, passwordHash, role]);
  return { ...rows[0], plainPassword: password };
};

export const generateAuthHeader = (userId: string, email: string, role: Role) => {
  const token = jwtService.generateAccessToken({ userId, email, role });
  return `Bearer ${token}`;
};
