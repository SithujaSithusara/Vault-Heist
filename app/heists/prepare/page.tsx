import { redirect } from 'next/navigation';
import { PortalHeader } from '@/components/portal/portalHeader';
import { Button } from '@/components/ui/button';
import { getCurrentSession } from '@/src/auth/sessions';
import { cancelPreparation, getPreparingHeist } from '@/src/heists/runs';

type PreparePageProps = {
  searchParams: Promise<{ run?: string | string[] }>;
};

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default async function PreparePage({ searchParams }: PreparePageProps) {
  const session = await getCurrentSession();
  if (!session) redirect('/');

  const { run } = await searchParams;
  if (typeof run !== 'string' || !uuidPattern.test(run)) redirect('/lobby');

  const slots = await getPreparingHeist(session, run);
  if (!slots) redirect('/lobby');

  async function cancel() {
    'use server';

    const currentSession = await getCurrentSession();
    if (!currentSession) redirect('/');

    await cancelPreparation(currentSession, run as string);
    redirect('/lobby');
  }

  return (
    <div className="min-h-svh bg-heist-bg font-heist-body text-heist-cream">
      <PortalHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <section className="rounded-3xl border-[3px] border-heist-ink bg-heist-panel p-6 sm:p-8">
          <h1 className="font-heist-display text-4xl font-semibold">
            Prepare heist
          </h1>
          <p className="mt-3 text-heist-muted">
            The timer starts when you enter the vault.
          </p>
          <ol className="mt-6 space-y-2">
            {slots.map(({ slot }) => (
              <li key={slot} className="rounded-xl border border-heist-edge px-4 py-3">
                Level {slot}
              </li>
            ))}
          </ol>
          <form action={cancel} className="mt-6">
            <Button type="submit" variant="outline" className="cursor-pointer">
              Cancel and return to lobby
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}