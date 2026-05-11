import { Router, Response } from 'express';
import authService from '../services/auth.service';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AuthRequest } from '../types';

const router = Router();

// Validation helper (very basic, in production use Joi/Zod)
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.post('/register', async (req, res: Response) => {
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Registrar novo usuário'
    #swagger.description = 'Cria um novo usuário com email e senha. Retorna os dados do usuário criado junto com accessToken (15min) e refreshToken (7 dias).'
  */
  /* #swagger.requestBody = {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/RegisterBody" }
      }
    }
  } */
  /* #swagger.responses[201] = {
    description: "Usuário registrado com sucesso",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/AuthTokensResponse" }
      }
    }
  } */
  /* #swagger.responses[400] = {
    description: "Dados inválidos ou email já registrado",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" }
      }
    }
  } */
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
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Autenticar usuário'
    #swagger.description = 'Autentica com email e senha. Retorna accessToken (15min) e refreshToken (7 dias).'
  */
  /* #swagger.requestBody = {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/LoginBody" }
      }
    }
  } */
  /* #swagger.responses[200] = {
    description: "Login realizado com sucesso",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/AuthTokensResponse" }
      }
    }
  } */
  /* #swagger.responses[400] = {
    description: "Email e senha são obrigatórios",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" }
      }
    }
  } */
  /* #swagger.responses[401] = {
    description: "Credenciais inválidas ou usuário inativo",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" }
      }
    }
  } */
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
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Dados do usuário autenticado'
    #swagger.description = 'Retorna os dados do usuário extraídos do JWT. Requer Bearer token válido.'
    #swagger.security = [{ "bearerAuth": [] }]
  */
  /* #swagger.responses[200] = {
    description: "Dados do usuário autenticado",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/UserResponse" }
      }
    }
  } */
  /* #swagger.responses[401] = {
    description: "Token ausente ou inválido",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" }
      }
    }
  } */
  // authMiddleware guarantees req.user exists
  return res.status(200).json({
    message: 'Dados do usuário autenticado',
    data: req.user
  });
});

router.post('/refresh', async (req, res: Response) => {
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Renovar access token'
    #swagger.description = 'Recebe um refreshToken válido e retorna um novo accessToken (15min).'
  */
  /* #swagger.requestBody = {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/RefreshBody" }
      }
    }
  } */
  /* #swagger.responses[200] = {
    description: "Token renovado com sucesso",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            message: { type: "string", example: "Token renovado com sucesso" },
            data: {
              type: "object",
              properties: {
                accessToken: { type: "string", example: "eyJ..." }
              }
            }
          }
        }
      }
    }
  } */
  /* #swagger.responses[400] = {
    description: "Refresh token não informado",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" }
      }
    }
  } */
  /* #swagger.responses[401] = {
    description: "Refresh token inválido ou expirado",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" }
      }
    }
  } */
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
  /*
    #swagger.tags = ['Auth']
    #swagger.summary = 'Encerrar sessão'
    #swagger.description = 'Revoga o accessToken atual e o refreshToken do usuário. Requer Bearer token válido.'
    #swagger.security = [{ "bearerAuth": [] }]
  */
  /* #swagger.responses[200] = {
    description: "Logout realizado com sucesso",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            message: { type: "string", example: "Logout realizado com sucesso" }
          }
        }
      }
    }
  } */
  /* #swagger.responses[401] = {
    description: "Token ausente ou inválido",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" }
      }
    }
  } */
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
