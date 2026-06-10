# MercaSimple

> A reference marketplace built with **Node.js + NestJS** microservices, containerised with **Docker** and orchestrated locally with **Docker Compose**. Designed to practice CI/CD, containerisation, and automated testing.

---

## Architecture

```
Client → Nginx (API Gateway :8080)
           ├── /auth/*        → auth-service    :3001  (PostgreSQL auth)
           ├── /users/*       → auth-service    :3001
           ├── /products/*    → catalog-service :3002  (PostgreSQL catalog)
           ├── /cart/*        → orders-service  :3003  (PostgreSQL orders + Redis)
           └── /orders/*      → orders-service  :3003
                    ↕ RabbitMQ (async)
               payments-service :3004 (PostgreSQL payments)
```

## Services

| Service          | Port | Responsibility                              |
|------------------|------|---------------------------------------------|
| api-gateway      | 8080 | Nginx reverse proxy, rate limiting          |
| auth-service     | 3001 | Registration, login, JWT, user profiles     |
| catalog-service  | 3002 | Product CRUD, search, pagination            |
| orders-service   | 3003 | Cart (Redis), order creation, stock check   |
| payments-service | 3004 | Simulated payment, idempotency, RabbitMQ    |

## Quick Start

### Prerequisites

- Docker ≥ 24
- Docker Compose plugin ≥ 2.20
- (Optional) Node.js 20 for local development

### 1. Clone & configure

```bash
git clone <repo-url> mercasimple
cd mercasimple
cp .env.example .env
# Edit .env — change JWT_SECRET and all DB passwords
```

### 2. Start everything

```bash
docker compose up --build
```

All services start in the correct order using `depends_on` health conditions. Once healthy, the API is available at `http://localhost:8080`.

### 3. Verify

```bash
curl http://localhost:8080/health
```

---

## API Reference

### Auth

| Method | Path              | Auth | Description            |
|--------|-------------------|------|------------------------|
| POST   | /auth/register    | No   | Register new user      |
| POST   | /auth/login       | No   | Login, get JWT         |
| GET    | /users/profile    | JWT  | Get own profile        |
| PATCH  | /users/profile    | JWT  | Update profile         |

**Register example:**
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@example.com","password":"password123","role":"seller","firstName":"Jane","lastName":"Doe"}'
```

**Login:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@example.com","password":"password123"}'
# Returns: {"accessToken":"<JWT>","user":{...}}
```

### Catalog

| Method | Path               | Auth        | Description                   |
|--------|--------------------|-------------|-------------------------------|
| GET    | /products          | No          | List products (paginated)      |
| GET    | /products/:id      | No          | Get single product             |
| POST   | /products          | JWT seller  | Create product                 |
| PATCH  | /products/:id      | JWT seller  | Update own product             |
| DELETE | /products/:id      | JWT seller  | Delete own product             |

**List products with filter:**
```bash
curl "http://localhost:8080/products?name=laptop&category=electronics&page=1&limit=10"
```

**Create product (seller):**
```bash
curl -X POST http://localhost:8080/products \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Laptop Pro","description":"Fast laptop","price":999.99,"stock":50,"category":"Electronics"}'
```

### Orders

| Method | Path               | Auth        | Description             |
|--------|--------------------|-------------|-------------------------|
| GET    | /cart              | JWT         | View cart               |
| POST   | /cart/items        | JWT         | Add item to cart        |
| DELETE | /cart/items/:pid   | JWT         | Remove item from cart   |
| POST   | /orders            | JWT         | Create order from cart  |
| GET    | /orders            | JWT         | List my orders          |
| GET    | /orders/:id        | JWT         | Get single order        |

**Add to cart:**
```bash
curl -X POST http://localhost:8080/cart/items \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"productId":"<product-uuid>","quantity":2}'
```

**Create order from cart (triggers async payment):**
```bash
curl -X POST http://localhost:8080/orders \
  -H "Authorization: Bearer <JWT>"
```

---

## Full E2E Flow

```bash
# 1. Register seller
SELLER=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@example.com","password":"password123"}' | jq -r .accessToken)

# 2. Create product
PRODUCT_ID=$(curl -s -X POST http://localhost:8080/products \
  -H "Authorization: Bearer $SELLER" \
  -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":19.99,"stock":100,"category":"Gadgets"}' | jq -r .id)

# 3. Register buyer & login
BUYER=$(curl -s -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com","password":"password123"}' | jq -r .accessToken)

# 4. Add to cart
curl -s -X POST http://localhost:8080/cart/items \
  -H "Authorization: Bearer $BUYER" \
  -H "Content-Type: application/json" \
  -d "{\"productId\":\"$PRODUCT_ID\",\"quantity\":2}"

# 5. Place order (payment processed async via RabbitMQ)
ORDER_ID=$(curl -s -X POST http://localhost:8080/orders \
  -H "Authorization: Bearer $BUYER" | jq -r .id)

# 6. Check order status (may update to 'paid' after a few seconds)
curl -s http://localhost:8080/orders/$ORDER_ID \
  -H "Authorization: Bearer $BUYER" | jq .status
```

---

## Development

### Run a single service locally

```bash
cd auth-service
npm install
cp ../.env.example .env   # fill in DB vars pointing to local postgres
npm run start:dev
```

### Hot-reload with Docker Compose

```bash
docker compose up
# Source changes in ./auth-service/src are reflected without rebuild
```

### Run tests

```bash
cd auth-service && npm test
cd auth-service && npm run test:cov   # with coverage report
```

---

## CI/CD

The `.github/workflows/` directory contains two pipelines:

| Workflow | Trigger | Steps |
|----------|---------|-------|
| `ci.yml` | push / PR to `main`, `develop` | lint → test → coverage → docker build → scan |
| `cd.yml` | merge to `main` | build → push to GHCR → deploy staging → [approval] → deploy prod |

### Rollback

```bash
# List available image tags
gh release list

# Re-deploy a previous tag
docker pull ghcr.io/<org>/mercasimple/auth-service:<sha>
# Update docker-compose.yml image tag and re-apply
```

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and change:

- `JWT_SECRET` — must be at least 32 random characters
- All `*_DB_PASSWORD` values
- `RABBITMQ_PASSWORD` for production

Secrets are **never** baked into images (RD-08, RS-05).

---

## Health Checks

Every service exposes `GET /health` returning a JSON health report:

```bash
curl http://localhost:8080/health        # gateway
curl http://localhost:3001/health        # auth (direct, dev only)
curl http://localhost:3002/health        # catalog
curl http://localhost:3003/health        # orders
curl http://localhost:3004/health        # payments
```

---

## Requirements Coverage

| ID | Requirement | Status |
|----|-------------|--------|
| RF-01..04 | User registration, login, JWT, profile | ✅ |
| RF-05..08 | Product CRUD, pagination, filter | ✅ |
| RF-09..13 | Cart, order creation, stock validation, history | ✅ |
| RF-14..16 | Simulated payment, status update, idempotency | ✅ |
| RNF-01 | `/health` endpoint per service | ✅ |
| RNF-03 | Structured JSON logs (Nginx) | ✅ |
| RNF-04 | Config via env vars | ✅ |
| RNF-07 | Passwords hashed with bcrypt | ✅ |
| RD-01..08 | Multi-stage Dockerfiles, non-root, HEALTHCHECK | ✅ |
| RDC-01..08 | Full docker-compose.yml with networks/volumes | ✅ |
| RCI-01..08 | GitHub Actions CI pipeline | ✅ |
| RCD-01..06 | GitHub Actions CD pipeline | ✅ |

---

*MercaSimple — v1.0.0*
