import { redirect } from 'next/navigation';
import { PortalHeader } from '@/components/portal/portalHeader';
import { Button } from '@/components/ui/button';
import { getCurrentSession } from '@/src/auth/sessions';
import { cancelPreparation, getPreparingHeist, startHeist } from '@/src/heists/runs';
import { prepareTerminalPuzzles } from '@/src/puzzles/assignment';

type PreparePageProps = {
  searchParams: Promise<{ run?: string | string[]; puzzle?: string | string[] }>;
};

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default async function PreparePage({ searchParams }: PreparePageProps) {
  const session = await getCurrentSession();
  if (!session) redirect('/');

  const { run, puzzle } = await searchParams;
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

  const ready = slots.every((slot) => slot.ready);

  async function loadPuzzles() {
    'use server';
    const currentSession = await getCurrentSession();
    if (!currentSession) redirect('/');

    const loaded = await prepareTerminalPuzzles(currentSession, run as string);
    redirect(`/heists/prepare?run=${run}${loaded ? '' : '&puzzle=unavailable'}`);
  }

  async function enterVault() {
    'use server';
    const currentSession = await getCurrentSession();
    if (!currentSession) redirect('/');

    const outcome = await startHeist(currentSession, run as string);

    if (outcome === 'signed-out') redirect('/');
    if (outcome === 'unavailable') redirect(`/heists/prepare?run=${run}`);

    redirect(`/heists/play?run=${run}`);
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
            {slots.map(({ slot, ready: terminalReady }) => (
              <li key={slot} className="rounded-xl border border-heist-edge px-4 py-3">
                Terminal {slot} · {terminalReady ? 'Ready' : 'Waiting for puzzle'}
              </li>
            ))}
          </ol>
          {!ready && puzzle === 'unavailable' && (
            <p role="alert" className="mt-4 text-heist-yellow">
              Some puzzles could not be loaded. Try loading puzzles again.
            </p>
          )}
          <form action={ready ? enterVault : loadPuzzles} className="mt-6">
            <Button
              type="submit"
              className="h-14 cursor-pointer rounded-xl border-[3px] border-heist-ink bg-heist-yellow px-6 font-extrabold text-heist-ink shadow-heist-button hover:bg-heist-yellow/90"
            >
              {ready ? 'Enter Vault' : 'Load puzzles'}
            </Button>
          </form>
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