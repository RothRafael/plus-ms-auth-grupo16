import { Request } from 'express';

export type Role = 'admin' | 'gestor' | 'vendedor';

export interface User {
  id: string;
  email: string;
  password?: string; // Should not be exposed in standard queries
  role: Role;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
}

export interface TokenBlacklist {
  id: string;
  token: string;
  user_id: string | null;
  revoked_at: Date;
  expires_at: Date;
  reason: string | null;
}

export interface Permission {
  id: string;
  role: Role;
  action: string;
  resource: string;
}

export interface AuthResponse {
  message: string;
  data?: any;
  error?: string;
}
