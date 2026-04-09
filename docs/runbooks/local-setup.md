# Local Development Setup

## Prerequisites
- Node.js >= 20
- Docker Desktop running
- npm >= 9

## 1. Clone and install

```bash
git clone <repo>
cd nativelayer
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in the required values:

```bash
# Generate ENCRYPTION_KEY (32-byte hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Generate ADMIN_PASSWORD_HASH (replace 'yourpassword')
node -e "
const c = require('crypto');
const salt = c.randomBytes(16).toString('hex');
const hash = c.scryptSync('yourpassword', salt, 64).toString('hex');
console.log(salt + ':' + hash);
"
```

Set `ADMIN_EMAIL` to the email you'll use to log in.

## 3. Start Postgres

```bash
docker-compose up -d
```

## 4. Run database migrations

```bash
cd apps/api
npm run db:generate   # if you changed the schema
npm run db:migrate
cd ../..
```

## 5. Seed a test merchant

```bash
node scripts/seed-merchant.mjs
```

This creates a merchant record and initializes all 4 capability rows to `disabled`.

## 6. Start all services

```bash
npm run dev
```

- API: http://localhost:3001
- Dashboard: http://localhost:3000

## 7. Verify

```bash
curl http://localhost:3001/health
# → {"status":"ok","version":"0.1.0","timestamp":"..."}
```

Log in at http://localhost:3000 with your `ADMIN_EMAIL` and the password you hashed above.
