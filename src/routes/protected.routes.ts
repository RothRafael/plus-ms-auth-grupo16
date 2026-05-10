import { Router, Response } from 'express';
import db from '../config/database';
import { authMiddleware, authorize, ownerOnly } from '../middlewares/auth.middleware';
import { AuthRequest } from '../types';

const router = Router();

// Apply auth middleware to all protected routes
router.use(authMiddleware);

// GET /api/users (admin only) - lista todos os usuários
router.get('/users', authorize('read', 'users'), async (req: AuthRequest, res: Response) => {
  try {
    const query = `SELECT id, email, role, is_active, created_at, updated_at FROM users`;
    const { rows } = await db.query(query);
    
    return res.status(200).json({
      message: 'Lista de usuários recuperada com sucesso',
      data: rows
    });
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/users/:userId - retorna dados do usuário (admin ou o próprio user)
router.get('/users/:userId', ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const query = `SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = $1`;
    const { rows } = await db.query(query, [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json({
      message: 'Dados do usuário recuperados com sucesso',
      data: rows[0]
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/users/:userId - atualiza email do usuário (admin ou o próprio user)
router.put('/users/:userId', ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório para atualização' });
    }

    const query = `
      UPDATE users 
      SET email = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING id, email, role, is_active, created_at, updated_at
    `;
    const { rows } = await db.query(query, [email, userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json({
      message: 'Usuário atualizado com sucesso',
      data: rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') { // Postgres unique violation code
      return res.status(400).json({ error: 'Email já está em uso por outro usuário' });
    }
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/users/:userId (admin only) - marca usuário como inativo
router.delete('/users/:userId', authorize('delete', 'users'), async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Prevent admin from deactivating themselves
    if (req.user?.userId === userId) {
      return res.status(400).json({ error: 'Não é possível desativar a própria conta' });
    }

    const query = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING id, email, is_active
    `;
    const { rows } = await db.query(query, [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    return res.status(200).json({
      message: 'Usuário desativado com sucesso',
      data: rows[0]
    });
  } catch (error) {
    console.error('Deactivate user error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/admin/stats (admin only) - retorna estatísticas
router.get('/admin/stats', authorize('read', 'stats'), async (req: AuthRequest, res: Response) => {
  try {
    // Execute multiple queries in parallel
    const [activeUsersResult, revokedTokensResult] = await Promise.all([
      db.query(`SELECT count(*) as count FROM users WHERE is_active = true`),
      db.query(`SELECT count(*) as count FROM token_blacklist`)
    ]);

    const activeUsers = parseInt(activeUsersResult.rows[0].count, 10);
    const revokedTokens = parseInt(revokedTokensResult.rows[0].count, 10);

    return res.status(200).json({
      message: 'Estatísticas recuperadas com sucesso',
      data: {
        activeUsers,
        revokedTokens
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
