import { randomUUID } from 'node:crypto';
import Image from 'next/image';
import { HeistFloor } from '@/components/heists/heistFloor';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getCurrentSession } from '@/src/auth/sessions';
import { abandonActiveHeist, chooseMaintenanceRoute, getActiveHeist } from '@/src/heists/runs';
import { CheckDigitButton, HeistTimer, ReplacementButton } from '@/components/heists/heistTimer';
import { replaceTerminalPuzzle, submitTerminalAnswer } from '@/src/puzzles/assignment';

type PlayPageProps = {
  searchParams: Promise<{ run?: string | string[]; answer?: string | string[]; terminal?: string | string[] }>;
};

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const session = await getCurrentSession();
  if (!session) redirect('/');

  const { run, answer, terminal } = await searchParams;
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

  const requestId = randomUUID();
  const selected = activeRun.terminals.find(({ slot }) => String(slot) === terminal)
    ?? activeRun.terminals.find(({ solvedDigit }) => solvedDigit === null)
    ?? activeRun.terminals[0];
  const { assignmentId, slot, solvedDigit, cooldownUntil, terminalStatus } = selected;
  const playPath = `/heists/play?run=${run}`;
  const runPath = `${playPath}&terminal=${slot}`;

  async function submitAnswer(formData: FormData) {
    'use server';

    const currentSession = await getCurrentSession();
    if (!currentSession) redirect('/');
    if (!assignmentId) redirect(runPath);

    const answer = formData.get('digit');
    if (typeof answer !== 'string' || !/^[0-9]$/.test(answer)) {
      redirect(`${runPath}&answer=invalid`);
    }

    const result = await submitTerminalAnswer(
      currentSession, run as string, assignmentId, requestId, Number(answer),
    );
    if (result === 'signed-out') redirect('/');
    if (result === 'correct') redirect(runPath);
    redirect(`${runPath}&answer=${result}`);
  }

  async function loadReplacement() {
    'use server';

    const currentSession = await getCurrentSession();
    if (!currentSession) redirect('/');

    const result = await replaceTerminalPuzzle(currentSession, run as string, slot);
    if (result === 'ready') redirect(runPath);
    redirect(`${runPath}&answer=${result}`);
  }

  const fallback = activeRun.route === 'fallback';
  const jammed = activeRun.terminals.some((entry) => entry.terminalStatus === 'jammed');

  async function takeMaintenanceRoute() {
    'use server';
    const currentSession = await getCurrentSession();
    if (!currentSession) redirect('/');

    const result = await chooseMaintenanceRoute(currentSession, run as string);
    if (result === 'signed-out') redirect('/');
    redirect(runPath);
  }

  const now = activeRun.observedAtMs;
  const initialElapsedMs = Math.max(0, now - activeRun.startedAt.getTime());
  const alarmRemainingMs = Math.max(0, (activeRun.puzzleAlarmUntil?.getTime() ?? 0) - now);
  const cooldownRemainingMs = Math.max(0, (cooldownUntil?.getTime() ?? 0) - now);

  return (
    <main className="grid min-h-svh place-items-center bg-heist-bg px-6 py-12 font-heist-body text-heist-cream">
      <section className="w-full max-w-7xl rounded-3xl border-[3px] border-heist-ink bg-heist-panel p-6 sm:p-8">
        <h1 className="font-heist-display text-4xl font-semibold">
          The Banana Reserve
        </h1>
        <HeistTimer
          key={`${run}:${initialElapsedMs}`}
          initialElapsedMs={initialElapsedMs}
          penaltySeconds={activeRun.wrongAnswers * 10}
          alarmRemainingMs={alarmRemainingMs}
        />

        {fallback && (
          <p className="mt-5 rounded-lg border border-heist-yellow px-3 py-2 font-bold text-heist-yellow">
            Maintenance route — not ranked.
          </p>
        )}
        {jammed && !fallback && (
          <details className="mt-5 rounded-lg border border-heist-yellow px-3 py-2">
            <summary className="cursor-pointer font-bold text-heist-yellow">A terminal is jammed</summary>
            <p className="mt-2 text-heist-muted">
              Take the maintenance route to continue unranked, or keep solving available terminals.
            </p>
            <form action={takeMaintenanceRoute} className="mt-3">
              <Button type="submit" variant="outline" className="enabled:cursor-pointer">
                Take maintenance route
              </Button>
            </form>
          </details>
        )}
        <HeistFloor
          key={run}
          playPath={playPath}
          selectedSlot={slot}
          solvedSlots={activeRun.terminals.filter((entry) => entry.solvedDigit !== null).map((entry) => entry.slot)}
          fallback={fallback}
          startedAtMs={activeRun.startedAt.getTime()}
          puzzleAlarmUntilMs={activeRun.puzzleAlarmUntil?.getTime() ?? null}
        >
          <section aria-labelledby="terminal-title" className="mt-6">
            <h2 id="terminal-title" className="font-heist-display text-2xl font-semibold">
              Terminal {slot}
            </h2>
            {solvedDigit !== null ? (
              <p className="mt-3 text-heist-mint">
                Terminal solved. Vault code digit {slot}: <strong>{solvedDigit}</strong>
              </p>
            ) : !assignmentId ? (
              <form action={loadReplacement} className="mt-4">
                <ReplacementButton key={`${run}:${initialElapsedMs}`} initialCooldownMs={cooldownRemainingMs} label={terminalStatus === 'jammed' ? 'Retry puzzle' : cooldownUntil ? 'Load replacement puzzle' : 'Load puzzle'} />
                {answer === 'puzzle-unavailable' && (
                  <p role="alert" className="mt-3 text-heist-yellow">
                    Could not load a puzzle for this terminal. Try again.
                  </p>
                )}
              </form>
            ) : (
              <>
                <Image
                  src={`/api/heists/puzzles/${assignmentId}/image`}
                  alt={`Banana number puzzle for Terminal ${slot}`}
                  width={600}
                  height={400}
                  unoptimized
                  className="mt-3 h-auto max-w-full rounded-xl"
                />
                <form action={submitAnswer} className="mt-4">
                  <label htmlFor="terminal-digit" className="block font-bold">
                    Missing digit
                  </label>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      id="terminal-digit"
                      name="digit"
                      inputMode="numeric"
                      pattern="[0-9]"
                      maxLength={1}
                      required
                      className="h-11 w-16 rounded-lg border border-heist-edge bg-heist-bg text-center font-heist-mono focus-visible:outline-2 focus-visible:outline-heist-mint"
                    />
                    <CheckDigitButton />
                  </div>
                </form>

                {answer === 'incorrect' && (
                  <p role="alert" className="mt-3 text-heist-red">Incorrect digit. +10 seconds.</p>
                )}
                {answer === 'invalid' && (
                  <p role="alert" className="mt-3 text-heist-red">Enter one digit from 0 to 9.</p>
                )}
                {answer === 'unavailable' && (
                  <p role="alert" className="mt-3 text-heist-yellow">This submission is no longer available.</p>
                )}
              </>
            )}
          </section>
        </HeistFloor>
        <form action={abandon} className="mt-6">
          <Button type="submit" variant="outline" className="cursor-pointer">
            Abandon run
          </Button>
        </form>
      </section>
    </main>
  );
}