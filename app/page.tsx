import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/auth/sessions';

type HomeProps = {
  searchParams: Promise<{ auth?: string | string[] }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const session = await getCurrentSession();

  if (session) {
    redirect('/lobby');
  }

  const { auth } = await searchParams;

  return (
    <main>
      <h1>Vault Heist</h1>
      <p>Infiltrate the Banana Reserve and escape with the fruit.</p>
      {auth === 'cancelled' && <p role="status">Sign-in was cancelled.</p>}
      {auth === 'failed' && <p role="alert">Sign-in failed. Please try again.</p>}
      <form action="/api/auth/google" method="get">
        <button type="submit">Continue with Google</button>
      </form>
    </main>
  );
}