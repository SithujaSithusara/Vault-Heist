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
      <form action="/api/auth/logout" method="post">
        <button type="submit">Sign out</button>
      </form>
    </main>
    
  );
}