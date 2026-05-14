# ADR — Decisões de arquitetura e linguagem (`plus-ms-auth`)

> Equipe Plus — Grupo 16 — ES2 (PUCRS) · 2026-05-13

> **Escopo:** este ADR documenta o `plus-ms-auth` (microsserviço de autenticação). Tudo descrito aqui está implementado neste repositório, com referência direta ao código.

---

## 1. Decisão Arquitetural

Implementar o MS Auth como serviço **Node.js 18 + TypeScript + Express 4**, com persistência em **PostgreSQL 15** via driver `pg` (sem ORM), autenticação híbrida **JWT HS256 de 15 min + refresh token opaco de 7 dias** em banco, hash de senhas com **bcrypt (saltRounds = 10)** e **RBAC baseado em tabela com cache em memória de 60s**. Documentação OpenAPI via `swagger-autogen` exposta em `/docs`. Testes de integração com **Vitest + Supertest** contra PostgreSQL real (`postgres:15-alpine` via `docker-compose.test.yml`).

---

## 2. Endpoints expostos

| Método | Rota | Auth | Origem |
| --- | --- | --- | --- |
| GET | `/health` | público | [src/index.ts:19](src/index.ts#L19) |
| GET | `/docs` | público | [src/index.ts:47](src/index.ts#L47) |
| POST | `/auth/register` | público | [src/routes/auth.routes.ts:11](src/routes/auth.routes.ts#L11) |
| POST | `/auth/login` | público | [src/routes/auth.routes.ts:70](src/routes/auth.routes.ts#L70) |
| POST | `/auth/refresh` | público (com refresh token) | [src/routes/auth.routes.ts:159](src/routes/auth.routes.ts#L159) |
| POST | `/auth/logout` | JWT | [src/routes/auth.routes.ts:226](src/routes/auth.routes.ts#L226) |
| GET | `/auth/me` | JWT | [src/routes/auth.routes.ts:129](src/routes/auth.routes.ts#L129) |
| GET | `/api/dashboard` | JWT | [src/routes/protected.routes.ts:12](src/routes/protected.routes.ts#L12) |
| GET | `/api/users` | `authorize('read','users')` | [src/routes/protected.routes.ts:30](src/routes/protected.routes.ts#L30) |
| GET | `/api/users/:userId` | `ownerOnly` | [src/routes/protected.routes.ts:84](src/routes/protected.routes.ts#L84) |
| PUT | `/api/users/:userId` | `ownerOnly` | [src/routes/protected.routes.ts:155](src/routes/protected.routes.ts#L155) |
| DELETE | `/api/users/:userId` | `authorize('delete','users')` | [src/routes/protected.routes.ts:256](src/routes/protected.routes.ts#L256) |
| GET | `/api/admin/stats` | `authorize('read','stats')` | [src/routes/protected.routes.ts:353](src/routes/protected.routes.ts#L353) |

---

## 3. Camadas do serviço

| Camada | Tecnologia | Localização |
| --- | --- | --- |
| HTTP API | Express 4 + TypeScript | [src/index.ts](src/index.ts), [src/routes/](src/routes/) |
| Serviços | auth / jwt / rbac | [src/services/](src/services/) |
| Middlewares | `authMiddleware`, `authorize`, `ownerOnly` | [src/middlewares/auth.middleware.ts](src/middlewares/auth.middleware.ts) |
| Tipos | `User`, `TokenPayload`, `Role` | [src/types/index.ts](src/types/index.ts) |
| Banco | PostgreSQL 15 via `pg` (pool `max: 20`) | [src/config/database.ts](src/config/database.ts) |
| Schema | 4 tabelas + 6 índices + seed RBAC | [scripts/init-db.sql](scripts/init-db.sql) |
| Documentação | Swagger UI em `/docs` | [src/swagger.ts](src/swagger.ts), [src/swagger-output.json](src/swagger-output.json) |
| Testes | Vitest + Supertest + Postgres real | [tests/](tests/), [docker-compose.test.yml](docker-compose.test.yml) |
| Container | `node:18-alpine` | [Dockerfile](Dockerfile) |

---

## 4. Tecnologias adotadas

### 4.1 Linguagem e runtime

**TypeScript** sobre Node.js 18. Tipos explícitos (`User`, `TokenPayload`, `Role = 'admin' | 'gestor' | 'vendedor'` — [src/types/index.ts:3](src/types/index.ts#L3)) reduzem a chance de erro em pontos sensíveis.

- Dev: `ts-node src/index.ts` (`npm run dev`).
- Prod: `tsc` → `dist/`, `node dist/index.js` (`npm start`).

### 4.2 Framework HTTP

**Express 4** pela familiaridade do time, ecossistema maduro e encaixe com middlewares próprios (`authMiddleware`, `authorize`, `ownerOnly`, handler global de erro). Separação em `routes/` (validação + chamada de serviço) e `services/` (regra de negócio + banco).

### 4.3 Banco

**PostgreSQL 15** acessado pelo driver `pg`, **sem ORM**. SQL explícito nos `services/` deixa óbvio o que acontece em queries críticas (login, validação de refresh, blacklist). Pool com `max: 20` em [src/config/database.ts:12](src/config/database.ts#L12).

Schema em [scripts/init-db.sql](scripts/init-db.sql):

- **Tabelas (4):** `users`, `refresh_tokens`, `token_blacklist`, `role_permissions`.
- **Índices (6):** `idx_users_email`, `idx_users_role`, `idx_token_blacklist_user_id`, `idx_token_blacklist_expires_at`, `idx_refresh_tokens_user_id`, `idx_role_permissions_role`.
- **Seed RBAC:** 16 permissões (8 admin + 5 gestor + 3 vendedor).

### 4.4 Documentação da API

`swagger-autogen` lê anotações inline (`/* #swagger.* */`) nas rotas e gera [src/swagger-output.json](src/swagger-output.json) via `npm run swagger`. A spec é servida em `/docs` por `swagger-ui-express`.

### 4.5 Testes

**Vitest + Supertest** batendo no `app` Express contra PostgreSQL real (`postgres:15-alpine` em [docker-compose.test.yml](docker-compose.test.yml)).

- Isolamento: `TRUNCATE ... RESTART IDENTITY CASCADE` em `beforeEach` ([tests/setup.ts:22-28](tests/setup.ts#L22-L28)).
- `fileParallelism: false` em [vitest.config.ts](vitest.config.ts) evita contenção no banco.
- Suíte:
  - [tests/integration/auth.test.ts](tests/integration/auth.test.ts) — register, login, refresh, logout.
  - [tests/integration/rbac.test.ts](tests/integration/rbac.test.ts) — matriz de permissões.
  - [tests/integration/security.test.ts](tests/integration/security.test.ts) — SQLi, tampering de JWT, reuso de token revogado.
  - [tests/smoke.test.ts](tests/smoke.test.ts) — health check.

---

## 5. Decisões de Segurança

### 5.1 Autenticação: JWT + refresh híbrido

- **Access token** — JWT **HS256**, `expiresIn = '15m'` (default, override por `JWT_EXPIRY`) — [src/services/jwt.service.ts:7](src/services/jwt.service.ts#L7). Carrega `userId`, `email`, `role`. Validação no middleware = só assinatura e `exp` (sem ida ao banco).
- **Refresh token** — string opaca gerada por `uuidv4() + uuidv4()` ([src/services/jwt.service.ts:30](src/services/jwt.service.ts#L30)), guardada em `refresh_tokens`, `expiresIn = '7d'` (default, override por `JWT_REFRESH_EXPIRY`). Validar = consultar banco e checar `revoked_at IS NULL` *e* `expires_at > CURRENT_TIMESTAMP`.
- **Logout** — insere o access corrente em `token_blacklist` (`expires_at` = `exp` do JWT) e revoga todos os refresh tokens do usuário. `authMiddleware` consulta a blacklist antes de aceitar o token.

**Sobre os tempos.** Access token curto (15 min) limita a janela de exposição em caso de vazamento e equilibra com o overhead de `/refresh`. Refresh token de 7 dias evita re-login frequente sem virar uma sessão eterna.

**Sobre o refresh opaco.** A fonte da verdade é o banco — `revoked_at IS NULL` basta pra invalidar e o token não carrega dados sensíveis.

**Sobre a blacklist de access.** Sem ela, o `logout` só impediria emissões novas — o último access continuaria valendo por até 15 min. A blacklist resolve isso com uma leitura no middleware sobre a coluna `token`, que é `UNIQUE` (ou seja, indexada).

### 5.2 Senhas: bcrypt

`saltRounds = 10` em [src/services/auth.service.ts:20](src/services/auth.service.ts#L20). bcrypt é o padrão consolidado pra hash de senhas, com salt embutido, custo configurável e recomendação válida do OWASP.

### 5.3 Autorização: RBAC com tabela + cache

Papéis (`admin`, `gestor`, `vendedor`) viajam no token; permissões vivem em `role_permissions(role, action, resource)`. O `RbacService` carrega tudo em memória com **TTL de 60s** (`CACHE_TTL = 60 * 1000` — [src/services/rbac.service.ts:7](src/services/rbac.service.ts#L7)), evitando ida ao banco em cada request protegida.

Middlewares ([src/middlewares/auth.middleware.ts](src/middlewares/auth.middleware.ts)):

- `authorize(action, resource)` — *factory*; cada rota declara o que precisa.
- `ownerOnly` — libera acesso ao próprio recurso (`req.params.userId === req.user.userId`) ou a quem tem `update` em `users`.

---

## 6. Consequências

### 6.1 Positivas

- Validação de access no middleware é O(1) (só JWT) — escala bem para rotas autenticadas.
- Logout efetivo via blacklist, mesmo com tokens ainda dentro do `exp`.
- RBAC cacheado (60s) evita ida ao banco em cada request protegida.
- TypeScript reduz classe inteira de bugs em pontos sensíveis (role, payload do token).
- Testes contra PostgreSQL real pegam regressões de SQL/schema que mocks esconderiam.

### 6.2 Negativas / Riscos

- Cache RBAC de 60s significa que mudança de permissão leva até 1 min para propagar.
- `token_blacklist` cresce com volume de logouts; um job de limpeza (`DELETE WHERE expires_at < now()`) será necessário caso o volume cresça.

---

## 7. Histórico de Revisões

| Versão | Data | Autor | Descrição |
| --- | --- | --- | --- |
| v1.0 | 2026-05-13 | Equipe Plus (Grupo 16) | Versão inicial — decisões de stack, segurança e testes do `plus-ms-auth`. |

