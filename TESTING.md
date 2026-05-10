# Documentação da Suíte de Testes - plus-ms-auth

Esta suíte de testes foi projetada para garantir a segurança, integridade e conformidade do microserviço de autenticação. Utilizamos uma abordagem de **Testes de Integração com Banco Real**, evitando mocks de persistência para validar as queries SQL e os fluxos de segurança (JWT/RBAC).

## Stack de Testes
- **Runner:** Vitest (Moderno, rápido, suporte nativo a TS).
- **HTTP client:** Supertest (Integração direta com Express).
- **Massa de dados:** Faker.js.
- **Infra:** Docker Compose (Postgres efêmero).

## Estrutura de Arquivos
```
tests/
├── integration/          # Testes de API reais
│   ├── auth.test.ts      # Registro, Login, Refresh, Logout
│   ├── rbac.test.ts      # Regras de acesso Admin/User
│   └── security.test.ts  # SQL Injection, JWT Tampering
├── helpers/
│   └── auth.helper.ts    # Utilitários para criação de usuários/tokens
├── setup.ts              # Setup global (limpeza de banco via TRUNCATE)
└── smoke.test.ts         # Teste de fumaça (Health Check)
```

## Como Executar

### 1. Preparar o Banco de Dados
Os testes exigem um banco PostgreSQL. Você pode subir o container de testes dedicado:

```bash
docker-compose -f docker-compose.test.yml up -d
```

### 2. Rodar os Testes
Para rodar toda a suíte uma única vez:
```bash
npm test
```

Para modo watch (desenvolvimento):
```bash
npm run test:watch
```

Para gerar relatório de cobertura (coverage):
```bash
npm run test:coverage
```

## Estratégias Utilizadas

### Isolamento e Limpeza
Utilizamos o hook `beforeEach` no `tests/setup.ts` para realizar um `TRUNCATE` em todas as tabelas de dados (usuários, tokens) antes de cada teste individual. Isso garante que um teste não dependa do estado deixado por outro.

### Segurança e RBAC
Os testes de RBAC validam a matriz de permissões carregada do banco de dados, simulando usuários com diferentes papéis e tentando acessar recursos restritos.

### Validação de JWT
Testamos não apenas o sucesso, mas também falhas críticas como:
- Tokens expirados.
- Tokens revogados (Blacklist).
- Tokens com assinaturas maliciosas.

## Adicionando Novos Testes
1. Crie um arquivo em `tests/integration/` seguindo o padrão `nome.test.ts`.
2. Utilize o `createTestUser` do `auth.helper.ts` para preparar o cenário.
3. Use o `request(app)` do Supertest para disparar as chamadas.
