import { requireAuth } from '@/lib/session';
import { getDb, auditLogs } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';

const PAGE_SIZE = 50;

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const db = getDb();
  const logs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.merchant_id, session.merchantId))
    .orderBy(desc(auditLogs.created_at))
    .limit(PAGE_SIZE)
    .offset(offset);

  return (
    <>
      <h1 className="page-title">Audit Logs</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Read-only log of all AI agent requests. Sensitive fields are redacted.
      </p>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Endpoint</th>
              <th>Method</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Correlation ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                  No requests logged yet.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.endpoint}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{log.method}</td>
                <td>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color:
                        log.status_code >= 500
                          ? '#dc2626'
                          : log.status_code >= 400
                          ? '#d97706'
                          : '#166534',
                    }}
                  >
                    {log.status_code}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {log.latency_ms != null ? `${log.latency_ms}ms` : '—'}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#9ca3af' }}>
                  {log.correlation_id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
        {page > 1 && (
          <a href={`/dashboard/logs?page=${page - 1}`} className="btn btn-ghost">
            ← Prev
          </a>
        )}
        {logs.length === PAGE_SIZE && (
          <a href={`/dashboard/logs?page=${page + 1}`} className="btn btn-ghost">
            Next →
          </a>
        )}
      </div>
    </>
  );
}
