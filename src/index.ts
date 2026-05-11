import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './routes/auth.routes';
import protectedRoutes from './routes/protected.routes';
import swaggerOutput from './swagger-output.json';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middlewares
app.use(cors()); // Allow all origins for now
app.use(express.json());

// Basic Health Check
app.get('/health', (req: Request, res: Response) => {
  /*
    #swagger.tags = ['Health']
    #swagger.summary = 'Health check'
    #swagger.description = 'Verifica se o serviço está no ar.'
  */
  /* #swagger.responses[200] = {
    description: "Serviço operacional",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            status: { type: "string", example: "OK" },
            timestamp: { type: "string", format: "date-time" }
          }
        }
      }
    }
  } */
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes Registration
app.use('/auth', authRoutes);
app.use('/api', protectedRoutes);

// Swagger UI — must come before the 404 handler
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerOutput as any));

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`plus-ms-auth rodando na porta ${PORT}`);
    console.log(`Swagger UI disponível em http://localhost:${PORT}/docs`);
  });
}

export default app;
