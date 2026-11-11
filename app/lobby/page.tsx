import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/auth/sessions';

export default async function LobbyPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/');
  }

  return (
    <main>
      <h1>Heist Lobby</h1>
      <p>Welcome, {session.displayName}.</p>
    </main>
  );
}