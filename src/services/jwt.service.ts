import jwt from 'jsonwebtoken';
import { TokenPayload } from '../types';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_that_must_be_at_least_32_characters_long';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

class JwtService {
  /**
   * Generates a new access token
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
      { userId: payload.userId, email: payload.email, role: payload.role },
      JWT_SECRET,
      { 
        expiresIn: JWT_EXPIRY as any, 
        algorithm: 'HS256' 
      }
    );
  }

  /**
   * Generates and stores a new refresh token in the whitelist
   */
  async generateRefreshToken(userId: string): Promise<string> {
    // Generate a secure random token for refresh
    const token = uuidv4() + uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(JWT_REFRESH_EXPIRY.replace('d', ''))); // roughly add days

    const query = `
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES ($1, $2, $3)
      RETURNING token;
    `;
    
    await db.query(query, [userId, token, expiresAt]);
    return token;
  }

  /**
   * Validates an access token
   */
  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }

  /**
   * Adds an access token to the blacklist
   */
  async blacklistToken(token: string, userId: string | null, expiresAt: Date, reason: string = 'logout'): Promise<void> {
    const query = `
      INSERT INTO token_blacklist (token, user_id, expires_at, reason)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (token) DO NOTHING;
    `;
    await db.query(query, [token, userId, expiresAt, reason]);
  }

  /**
   * Checks if a token is in the blacklist
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const query = `SELECT 1 FROM token_blacklist WHERE token = $1`;
    const { rowCount } = await db.query(query, [token]);
    return rowCount !== null && rowCount > 0;
  }

  /**
   * Revokes all refresh tokens for a user
   */
  async revokeUserRefreshTokens(userId: string): Promise<void> {
    const query = `
      UPDATE refresh_tokens 
      SET revoked_at = CURRENT_TIMESTAMP 
      WHERE user_id = $1 AND revoked_at IS NULL;
    `;
    await db.query(query, [userId]);
  }

  /**
   * Validates a refresh token and returns the user ID if valid
   */
  async validateRefreshToken(token: string): Promise<string | null> {
    const query = `
      SELECT user_id 
      FROM refresh_tokens 
      WHERE token = $1 
      AND revoked_at IS NULL 
      AND expires_at > CURRENT_TIMESTAMP;
    `;
    const { rows } = await db.query(query, [token]);
    return rows.length > 0 ? rows[0].user_id : null;
  }
}

export default new JwtService();
