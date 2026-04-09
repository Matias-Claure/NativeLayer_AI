import Link from 'next/link';
import { logoutAction } from '@/app/dashboard/actions';

export default function Nav() {
  return (
    <nav>
      <span className="brand">NativeLayer AI</span>
      <Link href="/dashboard">Overview</Link>
      <Link href="/dashboard/capabilities">Capabilities</Link>
      <Link href="/dashboard/keys">API Keys</Link>
      <Link href="/dashboard/logs">Audit Logs</Link>
      <form action={logoutAction} style={{ marginLeft: 'auto' }}>
        <button type="submit" className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>
          Sign out
        </button>
      </form>
    </nav>
  );
}
