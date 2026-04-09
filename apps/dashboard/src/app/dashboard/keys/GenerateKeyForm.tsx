'use client';

import { useActionState } from 'react';
import { generateKeyAction } from './actions';

export default function GenerateKeyForm({ merchantId }: { merchantId: string }) {
  const [state, formAction, isPending] = useActionState(generateKeyAction, { error: '' });

  return (
    <form action={formAction} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
      <input type="hidden" name="merchantId" value={merchantId} />
      <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
        <label htmlFor="keyName">Key name</label>
        <input id="keyName" name="name" type="text" placeholder="e.g. production-agent-1" required />
      </div>
      <button type="submit" className="btn btn-primary" disabled={isPending}>
        {isPending ? 'Generating…' : 'Generate key'}
      </button>
      {state.error && <p className="error-msg">{state.error}</p>}
    </form>
  );
}
