import { requireAuth } from '@/lib/session';
import { getDb, apiClients } from '@/lib/db';
import { eq } from 'drizzle-orm';
import GenerateKeyForm from './GenerateKeyForm';
import RevokeKeyButton from './RevokeKeyButton';

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ new_key?: string }>;
}) {
  const session = await requireAuth();
  const db = getDb();
  const params = await searchParams;

  const keys = await db
    .select()
    .from(apiClients)
    .where(eq(apiClients.merchant_id, session.merchantId))
    .orderBy(apiClients.created_at);

  return (
    <>
      <h1 className="page-title">API Keys</h1>

      {params.new_key && (
        <div className="card" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
          <strong style={{ color: '#166534' }}>New key generated — copy it now. It will not be shown again.</strong>
          <div style={{ fontFamily: 'monospace', marginTop: '0.75rem', padding: '0.75rem', background: '#fff', borderRadius: 6, border: '1px solid #86efac', wordBreak: 'break-all', fontSize: '0.9rem' }}>
            {params.new_key}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="section-title">Generate new key</h2>
        <GenerateKeyForm merchantId={session.merchantId} />
      </div>

      <div className="card">
        <h2 className="section-title">Active keys</h2>
        {keys.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No API keys yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td style={{ fontWeight: 500 }}>{key.name}</td>
                  <td style={{ fontFamily: 'monospace', color: '#6b7280' }}>{key.key_prefix}…</td>
                  <td>
                    <span className={key.is_active ? 'badge-enabled' : 'badge-disabled'}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    {new Date(key.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                    {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    {key.is_active && (
                      <RevokeKeyButton clientId={key.id} merchantId={session.merchantId} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
