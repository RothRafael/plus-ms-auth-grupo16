# Guia de Implementação e Evolução

Este documento detalha o que foi implementado no Microserviço de Autenticação e propõe próximos passos para escalar o serviço para produção de grande porte.

## O que foi implementado

1. **Autenticação Baseada em JWT com Segurança:**
   - Senhas passam por hash utilizando `bcrypt` (10 rounds de salt).
   - O segredo JWT é parametrizado via `.env`.
   - Access tokens expiram rapidamente (padrão de 15 minutos).
   - Refresh tokens são opacos (uuid randômico) e salvos no banco de dados para revogação global garantida.

2. **Revogação de Tokens (Blacklist):**
   - Implementamos uma tabela de `token_blacklist`. Ao realizar logout, o token ativo é adicionado a esta tabela.
   - O middleware valida ativamente cada requisição interceptando e barrando chamadas com tokens presentes na blacklist.
   - Refresh tokens sofrem "soft delete" (`revoked_at`), impedindo a criação de novos access tokens.

3. **Role-Based Access Control (RBAC):**
   - Tabela dedicada e relacional definindo `[role, action, resource]`.
   - Serviço de cache em memória no `rbac.service.ts` para evitar consultas ao banco a cada requisição (cache expira em 1 minuto).
   - Middleware flexível `authorize(action, resource)` que se adapta a novas regras no banco sem alteração no código.

4. **Tratamento de Erros e Padrões:**
   - Retornos seguem a padronização `{ error: "mensagem" }` para erros e `{ message: "...", data: {} }` para sucessos.
   - Respostas de exceção no servidor (500) não expõem a stack trace.

## Próximos Passos (Roadmap de Produção)

### Segurança Adicional
* **Rate Limiting:** Adicionar pacote `express-rate-limit` focado primariamente nas rotas `/auth/login` e `/auth/register` para mitigar ataques de força bruta.
* **Helmet:** Adicionar `helmet` para configurar headers HTTP de segurança (X-Frame-Options, Content-Security-Policy).
* **Validação Rigorosa:** Trocar as validações manuais simples nos controllers (como length de email e senha) por bibliotecas maduras como **Zod** ou **Joi**, acopladas como middlewares.

### Otimização e Performance
* **Redis:** Atualmente, a Token Blacklist e o Cache do RBAC residem em PostgreSQL e Memória do Node, respectivamente. Para múltiplos nós do serviço balanceados, o **Redis** é fortemente recomendado.
* **Paginação:** As rotas GET (como a `/api/users`) carecem de cursores/offsets.
* **Worker de Limpeza:** Adicionar um cronjob (`node-cron`) ou trigger no PostgreSQL para expurgar registros expirados na tabela `token_blacklist`.

### Testes
* **Testes Automatizados:** Integrar `Jest` e `Supertest`. Cobrir primeiramente os `Services` com testes unitários mockando o banco, e em seguida as rotas em E2E com um banco em memória.
