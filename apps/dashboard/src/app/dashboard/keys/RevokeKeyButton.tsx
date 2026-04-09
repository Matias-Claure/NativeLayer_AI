'use client';

import { useTransition } from 'react';
import { revokeKeyAction } from './actions';

interface Props {
  clientId: string;
  merchantId: string;
}

export default function RevokeKeyButton({ clientId, merchantId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleRevoke() {
    if (!confirm('Are you sure you want to revoke this key? This cannot be undone.')) return;
    startTransition(async () => {
      await revokeKeyAction(clientId, merchantId);
    });
  }

  return (
    <button
      onClick={handleRevoke}
      disabled={isPending}
      className="btn btn-danger"
      style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
    >
      {isPending ? '…' : 'Revoke'}
    </button>
  );
}
