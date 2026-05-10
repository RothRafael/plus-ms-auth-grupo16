import bcrypt from 'bcrypt';
import db from '../config/database';
import jwtService from './jwt.service';
import { User } from '../types';

class AuthService {
  /**
   * Registers a new user
   */
  async register(email: string, passwordPlain: string): Promise<{ user: User, accessToken: string, refreshToken: string }> {
    const normalizedEmail = email.toLowerCase();
    // Check if user exists
    const checkQuery = `SELECT 1 FROM users WHERE email = $1`;
    const { rowCount } = await db.query(checkQuery, [normalizedEmail]);
    if (rowCount && rowCount > 0) {
      throw new Error('Email already registered');
    }

    // Hash password with bcrypt (10 rounds)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(passwordPlain, saltRounds);

    // Default role is user
    const role = 'user';

    // Insert user into database
    const insertQuery = `
      INSERT INTO users (email, password, role)
      VALUES ($1, $2, $3)
      RETURNING id, email, role, is_active, created_at, updated_at;
    `;
    const { rows } = await db.query(insertQuery, [normalizedEmail, passwordHash, role]);
    const user = rows[0] as User;

    // Generate tokens
    const accessToken = jwtService.generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = await jwtService.generateRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  }

  /**
   * Authenticates a user and generates tokens
   */
  async login(email: string, passwordPlain: string): Promise<{ user: User, accessToken: string, refreshToken: string }> {
    const normalizedEmail = email.toLowerCase();
    const query = `SELECT id, email, password, role, is_active, created_at, updated_at FROM users WHERE email = $1`;
    const { rows } = await db.query(query, [normalizedEmail]);
    
    if (rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const userWithPassword = rows[0];

    // Check if user is active
    if (!userWithPassword.is_active) {
      throw new Error('User account is inactive');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(passwordPlain, userWithPassword.password);
    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Remove password from user object before returning
    const { password, ...user } = userWithPassword;

    // Generate tokens
    const accessToken = jwtService.generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    
    // Revoke old refresh tokens (optional based on security policy, but good for security)
    // await jwtService.revokeUserRefreshTokens(user.id);
    
    const refreshToken = await jwtService.generateRefreshToken(user.id);

    return { user: user as User, accessToken, refreshToken };
  }

  /**
   * Refreshes an access token using a valid refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const userId = await jwtService.validateRefreshToken(refreshToken);
    
    if (!userId) {
      throw new Error('Invalid or expired refresh token');
    }

    const query = `SELECT id, email, role, is_active FROM users WHERE id = $1`;
    const { rows } = await db.query(query, [userId]);
    
    if (rows.length === 0 || !rows[0].is_active) {
      throw new Error('User not found or inactive');
    }

    const user = rows[0];
    return jwtService.generateAccessToken({ userId: user.id, email: user.email, role: user.role });
  }

  /**
   * Revokes user tokens on logout
   */
  async logout(userId: string, accessToken: string, accessTokenExpiresAt: number): Promise<void> {
    // Start transaction if we want to ensure both operations succeed, but here simple async operations are fine
    await jwtService.revokeUserRefreshTokens(userId);
    
    // Convert epoch to Date
    const expiresAt = new Date(accessTokenExpiresAt * 1000);
    await jwtService.blacklistToken(accessToken, userId, expiresAt, 'logout');
  }
}

export default new AuthService();
