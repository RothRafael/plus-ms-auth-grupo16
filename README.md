# plus-ms-auth

Microserviço de Autenticação do projeto **Plus** — sistema de gestão de estoque de roupas.

Este serviço implementa autenticação via **JWT** (Access e Refresh tokens), proteção contra força bruta e **RBAC** (Role-Based Access Control).

## Topologia e Infraestrutura

Este projeto foi desenhado para rodar integrado ao ecossistema [plus-infra](https://github.com/pucrs-sweii-2026-1-30/plus-infra), que utiliza o **Ministack** para emular o ambiente AWS localmente.

### Dependências Externas
- **PostgreSQL:** Provisionado pelo Ministack (RDS).
- **API Gateway:** O roteamento externo é gerenciado pelo API Gateway do Ministack.

## Como Executar

### 1. Clonar o Repositório de Infraestrutura
Este microsserviço deve residir no mesmo diretório pai do `plus-infra`:

```
projeto/
├── plus-ms-auth/  ← este repositório
└── plus-infra/    ← repositório de infraestrutura
```

### 2. Configuração do Ambiente
Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

### 3. Iniciar via plus-infra
Para subir toda a stack (incluindo banco de dados e gateways):

```bash
cd ../plus-infra
make setup
```

O serviço estará disponível em `http://localhost:3001`.

## Desenvolvimento Local (Standalone)

Se desejar rodar apenas este serviço para desenvolvimento (assumindo que o banco de dados no `plus-infra` já esteja ativo):

```bash
npm install
npm run dev
```

## Banco de Dados
O schema é inicializado automaticamente no RDS do Ministack. Caso precise rodar manualmente, o script está em `scripts/init-db.sql`.

## Endpoints (via API Gateway)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/login` | Autentica e gera tokens |
| POST | `/auth/refresh` | Renova access token |
| POST | `/auth/logout` | Revoga tokens |
| GET | `/auth/me` | Dados do usuário logado |

---
*Para mais detalhes sobre a arquitetura e segurança, veja o [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md).*
