# Decisões de arquitetura e linguagem — projeto Plus

> Equipe Plus — ES2 (PUCRS) · 2026-05-13


## 1. Frontend: React + Vite + Module Federation

### 1.1 Stack

O `plus-shell` e o `plus-mfe-auth` usam **React 18 + TypeScript + Vite**. Vite oferece HMR rápido, build via `esbuild` e configuração enxuta, e mantém uma toolchain única entre host e remotos.

### 1.2 Module Federation

Os microfrontends são integrados em *runtime* via **Module Federation**, implementado pelo plugin `@originjs/vite-plugin-federation`. O shell declara os remotos e a lista de dependências compartilhadas em `vite.config.ts`; cada remote expõe seus módulos (`exposes`) e declara as mesmas dependências como `shared`:

```js
// vite.config.ts (plus-shell)
federation({
  name: "shell",
  remotes: {
    mfe_auth: process.env.MFE_AUTH_URL
      || "http://localhost:4001/assets/remoteEntry.js",
  },
  shared: [
    "react", "react-dom",
    "@mui/material", "@mui/icons-material",
    "@emotion/react", "@emotion/styled",
    "react-router-dom",
  ],
})
```

Em uma frase: o shell consegue `import`ar um componente React de outro repositório *em runtime*, baixando o código pela rede no momento em que o usuário acessa a tela.

### 1.3 O que isso traz

- **Deploys independentes:** cada microfrontend é publicado em produção sem rebuild do host nem dos demais remotos.
- **Compartilhamento de dependências:** a lista `shared` evita carregar React/MUI duas vezes (e o consequente *context split* que quebra hooks e Context API).
- **Integração de rotas:** o shell controla o `react-router-dom`; os remotos expõem componentes React que se integram ao `<Routes>` do host.

### 1.4 Parametrização por ambiente

A URL do `remoteEntry.js` é parametrizada por `MFE_AUTH_URL` em *build time* (`ARG` no Dockerfile, injetado no pipeline pelo `plus-infra`), permitindo dev/staging/prod sem alterar código-fonte.

### 1.5 Limitação em dev e mitigação

O plugin não emula Module Federation completamente em `vite dev`. Os remotos são servidos via `vite build && vite preview` para o host consumi-los. O fluxo é padronizado pelo Docker Compose do `plus-infra`.

---

## 2. Backend: `plus-ms-auth`

A partir daqui o documento foca no microsserviço de autenticação.

### 2.1 Linguagem: TypeScript

O serviço é escrito em **TypeScript** sobre Node.js. Tipos explícitos (`User`, `TokenPayload`, `Role`) reduzem a chance de erro em pontos sensíveis — por exemplo, garantir que o `role` seja sempre `'admin' | 'gestor' | 'vendedor'` em vez de qualquer string. As definições ficam em `src/types/index.ts`.

Em desenvolvimento, a execução é via `ts-node src/index.ts` (`npm run dev`). Em produção, `tsc` compila `src/` para `dist/` e o serviço roda com `node dist/index.js` (`npm start`).

### 2.2 Framework HTTP: Express

Usamos **Express 4** pela familiaridade do time, ecossistema maduro e bom encaixe com middlewares próprios (`authMiddleware`, `authorize`, `ownerOnly` e um handler global de erro).

A separação em `routes/`, `services/`, `middlewares/` e `config/` mantém as rotas finas (validação + chamada de serviço) e a lógica de negócio nos serviços.

### 2.3 Banco de dados: PostgreSQL

Usamos **PostgreSQL 15** acessado pelo driver `pg` (sem ORM):

- O `plus-infra` já provisiona PostgreSQL via Ministack para os serviços do projeto — coerência de stack.
- Sem ORM significa SQL explícito (`src/services/*.ts`), o que deixa óbvio o que está acontecendo em queries críticas (login, validação de refresh, blacklist).
- Pool de conexões com `max: 20` (`src/config/database.ts`) é suficiente pro perfil de carga esperado.

O schema é inicializado por `scripts/init-db.sql` e contém as tabelas `users`, `refresh_tokens`, `token_blacklist` e `role_permissions`, com índices em `users.email`, `token_blacklist.expires_at` e `role_permissions.role`.

### 2.4 Autenticação: JWT + refresh token

A escolha central do serviço. Adotamos um modelo **híbrido**:

- **Access token** — JWT (HS256), expira em **15 minutos**. Carrega `userId`, `email` e `role`. Verificação no middleware é só conferir assinatura e `exp`, sem ir no banco.
- **Refresh token** — string opaca (dois UUIDv4 concatenados), guardada na tabela `refresh_tokens`, expira em **7 dias**. Validar = consultar o banco e checar `revoked_at IS NULL` *e* `expires_at > CURRENT_TIMESTAMP`.
- **Logout** — coloca o access token corrente na `token_blacklist` (com `expires_at` igual ao `exp` do JWT) e marca os refresh tokens do usuário como revogados. O middleware consulta a blacklist antes de aceitar o token.

**Sobre os tempos.** Access token curto (15 min) limita a janela de exposição em caso de vazamento e equilibra com o overhead de `/refresh`. Refresh token de 7 dias evita re-login frequente sem virar uma sessão eterna.

**Sobre o refresh opaco.** O refresh é uma string opaca porque a fonte da verdade é o banco — `revoked_at IS NULL` basta pra invalidar e o token não carrega dados sensíveis.

**Sobre a blacklist de access.** Sem ela, o `logout` só impediria emissões novas — o último access continuaria valendo por até 15 min. A blacklist resolve isso com uma leitura no middleware sobre a coluna `token`, que é `UNIQUE` (ou seja, indexada).

### 2.5 Senhas: bcrypt

Senhas são armazenadas com **bcrypt** (`saltRounds = 10` em `src/services/auth.service.ts`). bcrypt é o padrão consolidado pra hash de senhas, com salt embutido, custo configurável e recomendação válida do OWASP.

### 2.6 Autorização: RBAC com tabela + cache

Os papéis (`admin`, `gestor`, `vendedor`) ficam no token, mas as permissões em si vivem na tabela `role_permissions(role, action, resource)` — pré-populada com 16 permissões em `scripts/init-db.sql`. O `RbacService` carrega tudo em memória e atualiza o cache a cada 60s, evitando ida ao banco a cada requisição protegida.

O middleware `authorize(action, resource)` é uma *factory* — cada rota declara o que precisa em vez de espalhar `if` de permissão pela lógica. Existe também `ownerOnly`, que libera acesso ao próprio recurso (`req.params.userId === req.user.userId`) ou a quem tem permissão de `update` em `users`.

### 2.7 Documentação: Swagger/OpenAPI

Os endpoints estão documentados com `swagger-autogen` (anotações inline nas rotas, no formato `/* #swagger.* */`) e expostos em `/docs` via `swagger-ui-express`. O script `npm run swagger` gera `src/swagger-output.json`, servido pelo `index.ts`.

### 2.8 Testes: Vitest com banco real

Usamos **Vitest** com `Supertest` batendo no `app` Express. Os testes de integração sobem um PostgreSQL via `docker-compose.test.yml` (imagem `postgres:15-alpine`), validando as queries SQL e os fluxos de segurança (JWT/RBAC) contra um banco real.

Isolamento: `tests/setup.ts` faz `TRUNCATE` das tabelas em `beforeEach`. `fileParallelism: false` em `vitest.config.ts` garante que os testes não disputem o mesmo banco em paralelo.

A suíte está organizada em:

- `tests/integration/auth.test.ts` — register, login, refresh, logout.
- `tests/integration/rbac.test.ts` — matriz de permissões por *role*.
- `tests/integration/security.test.ts` — SQL injection, tampering de JWT, reuso de token revogado.
- `tests/smoke.test.ts` — health check.

---

## 3. Integração frontend ↔ backend

O fluxo ponta a ponta funciona assim:

1. Usuário acessa o `plus-shell`, que carrega o `plus-mfe-auth` via Module Federation (URL do `remoteEntry.js` resolvida em build).
2. Tela de login do MFE faz `POST /auth/login` contra o `plus-ms-auth` (roteado pelo API Gateway do Ministack).
3. Serviço responde com `{ accessToken, refreshToken }`. O shell guarda os tokens e injeta o `Authorization: Bearer <accessToken>` nas chamadas seguintes.
4. Em rotas protegidas, o `authMiddleware` valida assinatura e `exp` do JWT e checa a `token_blacklist`.
5. Quando o access expira (15 min), o front chama `POST /auth/refresh` com o refresh token e recebe um novo access — sem novo login.
6. `POST /auth/logout` revoga o access (blacklist) e todos os refresh tokens do usuário.

---

## 4. Estrutura do repositório `plus-ms-auth`

```
src/
  config/database.ts              # Pool pg compartilhado
  middlewares/auth.middleware.ts  # authMiddleware, authorize, ownerOnly
  routes/auth.routes.ts           # /auth/* (register, login, refresh, logout, me)
  routes/protected.routes.ts      # /api/* (rotas que exigem auth)
  services/auth.service.ts        # register, login, refresh, logout
  services/jwt.service.ts         # geração e validação de tokens
  services/rbac.service.ts        # cache + checagem de permissões
  types/index.ts                  # User, TokenPayload, Role, etc.
  swagger.ts                      # gera swagger-output.json
  swagger-output.json             # spec OpenAPI 3.0 gerada
  index.ts                        # bootstrap do Express
scripts/
  init-db.sql                     # schema + seed de permissões
tests/
  integration/                    # auth, rbac, security
  helpers/auth.helper.ts          # createTestUser, gerar tokens
  setup.ts                        # TRUNCATE global em beforeEach
  smoke.test.ts                   # health check
```

A regra é simples: `routes` valida entrada e chama `service`; `service` contém a regra de negócio e fala com o banco; `middlewares` cuidam de *cross-cutting concerns* (autenticação, autorização).
