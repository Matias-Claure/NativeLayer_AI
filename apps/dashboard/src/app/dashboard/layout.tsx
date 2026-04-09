import { requireAuth } from '@/lib/session';
import Nav from '@/components/Nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        {children}
      </main>
    </>
  );
}
