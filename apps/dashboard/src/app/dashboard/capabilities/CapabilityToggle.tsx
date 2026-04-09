'use client';

import { useTransition } from 'react';
import { toggleCapabilityAction } from './actions';

interface Props {
  merchantId: string;
  capability: string;
  enabled: boolean;
}

export default function CapabilityToggle({ merchantId, capability, enabled }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleCapabilityAction(merchantId, capability, !enabled);
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`btn ${enabled ? 'btn-danger' : 'btn-primary'}`}
      style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
    >
      {isPending ? '…' : enabled ? 'Disable' : 'Enable'}
    </button>
  );
}
