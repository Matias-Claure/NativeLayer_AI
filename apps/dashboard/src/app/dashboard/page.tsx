import { requireAuth } from '@/lib/session';
import { getDb, merchants, endpointSettings, apiClients, auditLogs } from '@/lib/db';
import { eq, count, desc } from 'drizzle-orm';

export default async function DashboardOverview() {
  const session = await requireAuth();
  const db = getDb();

  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, session.merchantId));
  const capabilities = await db.select().from(endpointSettings).where(eq(endpointSettings.merchant_id, session.merchantId));
  const [keyCount] = await db.select({ count: count() }).from(apiClients).where(eq(apiClients.merchant_id, session.merchantId));
  const [logCount] = await db.select({ count: count() }).from(auditLogs).where(eq(auditLogs.merchant_id, session.merchantId));

  const enabledCount = capabilities.filter((c) => c.enabled).length;

  return (
    <>
      <h1 className="page-title">Overview</h1>

      {merchant && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{merchant.shop_domain}</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Shopify store</div>
            </div>
            <span className={merchant.status === 'active' ? 'badge-enabled' : 'badge-disabled'}>
              {merchant.status}
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2563eb' }}>{enabledCount} / {capabilities.length || 4}</div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>Capabilities enabled</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2563eb' }}>{keyCount?.count ?? 0}</div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>API keys</div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2563eb' }}>{logCount?.count ?? 0}</div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>Total requests logged</div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Quick links</h2>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', listStyle: 'none' }}>
          <li><a href="/dashboard/capabilities" style={{ color: '#2563eb' }}>→ Manage AI capabilities</a></li>
          <li><a href="/dashboard/keys" style={{ color: '#2563eb' }}>→ Generate or revoke API keys</a></li>
          <li><a href="/dashboard/logs" style={{ color: '#2563eb' }}>→ View audit logs</a></li>
        </ul>
      </div>
    </>
  );
}
