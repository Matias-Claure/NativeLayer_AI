import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  const session = await getSession();
  if (session.isLoggedIn) redirect('/dashboard');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          NativeLayer AI
        </h1>
        <LoginForm />
      </div>
    </div>
  );
}
