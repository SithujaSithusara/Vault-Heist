import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getCurrentSession } from '@/src/auth/sessions';
import { abandonActiveHeist, getActiveHeist } from '@/src/heists/runs';

type PlayPageProps = {
  searchParams: Promise<{ run?: string | string[] }>;
};

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const session = await getCurrentSession();
  if (!session) redirect('/');

  const { run } = await searchParams;
  if (typeof run !== 'string' || !uuidPattern.test(run)) redirect('/lobby');

  const activeRun = await getActiveHeist(session, run);
  if (!activeRun) redirect('/lobby');

  async function abandon() {
    'use server';
    const currentSession = await getCurrentSession();
    if (!currentSession) redirect('/');

    await abandonActiveHeist(currentSession, run as string);
    redirect('/lobby');
  }

  const startedAt = activeRun.startedAt.toISOString();

  return (
    <main className="grid min-h-svh place-items-center bg-heist-bg px-6 py-12 font-heist-body text-heist-cream">
      <section className="w-full max-w-2xl rounded-3xl border-[3px] border-heist-ink bg-heist-panel p-6 sm:p-8">
        <h1 className="font-heist-display text-4xl font-semibold">
          The Banana Reserve
        </h1>
        <p className="mt-3 text-heist-muted">
          Run started at{' '}
          <time dateTime={startedAt} className="font-heist-mono">
            {startedAt.slice(11, 19)} UTC
          </time>
        </p>

        <form action={abandon} className="mt-6">
          <Button type="submit" variant="outline" className="cursor-pointer">
            Abandon run
          </Button>
        </form>
      </section>
    </main>
  );
}