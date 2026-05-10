import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import jwtService from '../services/jwt.service';
import rbacService from '../services/rbac.service';

/**
 * Middleware to authenticate user via JWT
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido ou em formato inválido' });
    }

    const token = authHeader.split(' ')[1];

    // Check if token is in blacklist
    const isBlacklisted = await jwtService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token revogado' });
    }

    const decoded = jwtService.verifyAccessToken(token);
    req.user = decoded;
    
    // Store original token on request for potential logout invalidation
    (req as any).token = token;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

/**
 * Factory function to create an RBAC authorization middleware
 */
export const authorize = (action: string, resource: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      // Check permissions from database through service
      const hasPermission = await rbacService.hasPermission(req.user.role, action, resource);
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'Acesso negado: permissão insuficiente' });
      }

      next();
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao verificar autorização' });
    }
  };
};

/**
 * Middleware to ensure the user is either an admin or the owner of the resource
 * Assumes the resource ID is passed as req.params.userId
 */
export const ownerOnly = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const targetUserId = req.params.userId;
    const isOwner = req.user.userId === targetUserId;
    
    // Check if admin
    const isAdmin = await rbacService.hasPermission(req.user.role, 'update', 'users');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Acesso negado: apenas o dono ou admin pode acessar' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao verificar autorização de dono' });
  }
};
