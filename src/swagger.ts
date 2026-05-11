// Build script: generates src/swagger-output.json from #swagger annotations in route files.
// Run with: ts-node src/swagger.ts

// eslint-disable-next-line @typescript-eslint/no-require-imports
const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });

const outputFile = './src/swagger-output.json';
// Use only the Express entry point — swagger-autogen follows imports and combines
// app.use() prefixes (/auth, /api) with the router-level paths automatically.
const endpointsFiles = ['./src/index.ts'];

const doc = {
  info: {
    title: 'Plus MS Auth',
    version: '1.0.0',
    description:
      'Microserviço de autenticação JWT com refresh tokens e controle de acesso por role (RBAC). ' +
      'Roles disponíveis: admin, moderator, user.',
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Desenvolvimento local' },
    { url: 'http://localhost:4566/auth', description: 'Ministack (LocalStack)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      RegisterBody: {
        $email: 'joao@loja.com',
        $password: 'senha123',
      },
      LoginBody: {
        $email: 'joao@loja.com',
        $password: 'senha123',
      },
      RefreshBody: {
        $refreshToken: 'uuid-longo-aqui',
      },
      UpdateUserBody: {
        $email: 'novo@email.com',
      },
      UserResponse: {
        id: 'uuid',
        email: 'joao@loja.com',
        role: 'user',
        is_active: true,
        created_at: '2026-05-12T10:00:00Z',
      },
      AuthTokensResponse: {
        user: {},
        accessToken: 'eyJ...',
        refreshToken: 'uuid...',
      },
      ErrorResponse: {
        error: 'mensagem de erro',
      },
      StatsResponse: {
        activeUsers: 42,
        revokedTokens: 7,
      },
      RoleEnum: {
        '@enum': ['admin', 'moderator', 'user'],
      },
    },
  },
};

swaggerAutogen(outputFile, endpointsFiles, doc);
