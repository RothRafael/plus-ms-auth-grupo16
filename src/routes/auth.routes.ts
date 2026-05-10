import { Router, Response } from 'express';
import authService from '../services/auth.service';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AuthRequest } from '../types';

const router = Router();

// Validation helper (very basic, in production use Joi/Zod)
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.post('/register', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const data = await authService.register(email, password);
    return res.status(201).json({
      message: 'Usuário registrado com sucesso',
      data
    });
  } catch (error: any) {
    if (error.message === 'Email already registered') {
      return res.status(400).json({ error: 'Email já registrado' });
    }
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const data = await authService.login(email, password);
    return res.status(200).json({
      message: 'Login realizado com sucesso',
      data
    });
  } catch (error: any) {
    if (error.message === 'Invalid credentials' || error.message === 'User account is inactive') {
      return res.status(401).json({ error: 'Credenciais inválidas ou usuário inativo' });
    }
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  // authMiddleware guarantees req.user exists
  return res.status(200).json({
    message: 'Dados do usuário autenticado',
    data: req.user
  });
});

router.post('/refresh', async (req, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token é obrigatório' });
    }

    const accessToken = await authService.refreshAccessToken(refreshToken);
    return res.status(200).json({
      message: 'Token renovado com sucesso',
      data: { accessToken }
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
  }
});

router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const accessToken = (req as any).token;
    // user.exp is in seconds (epoch), if undefined fallback to 15m default
    const exp = user.exp || Math.floor(Date.now() / 1000) + 900; 

    await authService.logout(user.userId, accessToken, exp);

    return res.status(200).json({
      message: 'Logout realizado com sucesso'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
