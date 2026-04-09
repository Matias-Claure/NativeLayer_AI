'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, { error: '' });

  return (
    <form action={formAction}>
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {state.error && <p className="error-msg">{state.error}</p>}
      <button type="submit" className="btn btn-primary" disabled={isPending} style={{ width: '100%', justifyContent: 'center' }}>
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
