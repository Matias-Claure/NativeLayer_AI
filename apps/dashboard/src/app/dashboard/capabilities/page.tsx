import { requireAuth } from '@/lib/session';
import { getDb, endpointSettings } from '@/lib/db';
import { eq } from 'drizzle-orm';
import CapabilityToggle from './CapabilityToggle';
import { CAPABILITIES } from '@nativelayer/schemas';

export default async function CapabilitiesPage() {
  const session = await requireAuth();
  const db = getDb();

  const rows = await db
    .select()
    .from(endpointSettings)
    .where(eq(endpointSettings.merchant_id, session.merchantId));

  const capabilityMap = new Map(rows.map((r) => [r.capability, r.enabled]));

  return (
    <>
      <h1 className="page-title">AI Capabilities</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Control which actions AI agents may perform. All capabilities start disabled by default.
      </p>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((cap) => {
              const endpointMap: Record<string, string> = {
                search: 'POST /ai/search',
                product_detail: 'GET /ai/product/:id',
                cart: 'POST /ai/cart',
                checkout_handoff: 'POST /ai/checkout-handoff',
              };
              const enabled = capabilityMap.get(cap) ?? false;
              return (
                <tr key={cap}>
                  <td style={{ fontWeight: 500 }}>{cap}</td>
                  <td style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {endpointMap[cap]}
                  </td>
                  <td>
                    <span className={enabled ? 'badge-enabled' : 'badge-disabled'}>
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <CapabilityToggle
                      merchantId={session.merchantId}
                      capability={cap}
                      enabled={enabled}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
