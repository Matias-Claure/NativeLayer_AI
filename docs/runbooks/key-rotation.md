# API Key Rotation Runbook

## When to rotate
- Scheduled quarterly rotation
- Suspected key compromise
- Employee offboarding (for human-operated keys)
- Before and after any security incident

## Steps

### 1. Generate a new key
In the dashboard at `/dashboard/keys`:
1. Click **Generate key**
2. Give it a name (e.g. `production-agent-2`)
3. Copy the raw key immediately — it will not be shown again

### 2. Update the AI client
Update the `X-API-Key` header in the consuming AI system to use the new key.

### 3. Test the new key
```bash
curl -X POST http://localhost:3001/ai/search \
  -H "X-API-Key: <new-raw-key>" \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
```
Expect: `200` response (if search capability is enabled) or `403` (if disabled).

### 4. Revoke the old key
In the dashboard at `/dashboard/keys`, click **Revoke** next to the old key.

### 5. Confirm revocation
```bash
curl -X POST http://localhost:3001/ai/search \
  -H "X-API-Key: <old-raw-key>" \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
```
Expect: `401` response.

## ENCRYPTION_KEY rotation (Shopify token re-encryption)
The `ENCRYPTION_KEY` encrypts stored Shopify tokens. Rotating it requires re-encrypting all tokens:

1. Generate a new `ENCRYPTION_KEY`
2. Run the re-encryption script (to be implemented): decrypt all tokens with the old key, re-encrypt with the new key, update the DB in a transaction
3. Update `ENCRYPTION_KEY` in the environment
4. Restart the API service
5. Verify the API can still call Shopify

**Never rotate ENCRYPTION_KEY without completing the re-encryption step first.**
