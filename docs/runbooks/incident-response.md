# Incident Response Runbook

## Compromised API Key

1. **Revoke immediately** via dashboard → API Keys → Revoke
2. Check audit logs (`/dashboard/logs`) for the `client_id` of the compromised key
3. Review all requests from that client in the past 24–48 hours
4. Rotate any correlated keys if the same credential set was reused
5. If Shopify calls were made unexpectedly, contact Shopify support to review order/cart activity

## Suspected merchant account compromise

1. **Suspend the merchant** — update `merchants.status = 'suspended'` in the DB:
   ```sql
   UPDATE merchants SET status = 'suspended' WHERE shop_domain = 'store.myshopify.com';
   ```
2. All subsequent requests will return `401` (auth plugin checks merchant status)
3. Investigate audit logs for anomalous patterns
4. If the Shopify token was exposed, rotate it in Shopify admin and re-encrypt in our DB
5. Re-activate the merchant by setting `status = 'active'` once the incident is resolved

## Database access anomaly

1. Review Postgres logs for unexpected connections
2. Rotate the `DATABASE_URL` password in the environment
3. Restart both API and dashboard services
4. Confirm `ENCRYPTION_KEY` was not exposed (if it was, follow ENCRYPTION_KEY rotation runbook)

## High error rate

Check the following in order:
1. `GET /health` — is the API up?
2. Audit logs — what endpoints are failing and with what status codes?
3. Shopify status page — is Shopify having an incident?
4. Check Postgres connectivity: `docker-compose ps` or equivalent
5. Check rate limiting: are legitimate clients being throttled? Adjust `RATE_LIMIT_RPM` if needed

## Contact

For any active incident affecting merchant data, notify the data protection lead immediately.
