import Image from 'next/image';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { PortalHeader } from '@/components/portal/portalHeader';
import { Button } from '@/components/ui/button';
import { getCurrentSession } from '@/src/auth/sessions';

const panel = 'rounded-3xl border-[3px] border-heist-ink bg-heist-panel';
const label = 'font-heist-mono text-xs font-medium uppercase';

type LobbyPageProps = {
  searchParams: Promise<{ heist?: string | string[] }>;
};

export default async function LobbyPage({ searchParams }: LobbyPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect('/');
  }

  const { heist } = await searchParams;

  return (
    <div className="min-h-svh bg-heist-bg font-heist-body font-bold text-heist-cream">
      <div className="mx-auto max-w-[1440px]">
        <PortalHeader />

        <main className="px-6 pt-10 pb-10 sm:px-10 xl:px-[72px] xl:pt-[52px]">
          <p className={`${label} text-heist-yellow`}>Welcome back, agent</p>
          <h1 className="mt-4 font-heist-display text-[clamp(2rem,4vw,3rem)] leading-[1.08] font-semibold">
            Ready for a little monkey business?
          </h1>
          {heist === 'already-open' && (
            <p role="status" className="mt-4 font-bold text-heist-yellow">
              You already have an open heist. Finish or cancel it in the session that opened it.
            </p>
          )}

          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,770fr)_minmax(0,498fr)] xl:mt-[42px] xl:gap-7">
            <section
              aria-labelledby="mission-title"
              className={`${panel} relative grid min-w-0 p-6 sm:p-7 xl:min-h-[490px]`}
            >
              <div className="relative z-10">
                <p className={`${label} text-heist-yellow`}>Your next target</p>
                <h2
                  id="mission-title"
                  className="mt-5 font-heist-display text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.08] font-semibold uppercase"
                >
                  The Banana Reserve
                </h2>
                <p className="mt-4 text-lg text-heist-muted">
                  Floor 01 · Standard heist
                </p>
                <p className="mt-5 text-lg leading-[1.4]">
                  Stay in cover. Solve the locks.
                  <br />
                  Grab the fruit. Make it out.
                </p>
              </div>

              <Image
                src="/art/lobby-vault.svg"
                alt=""
                width={343}
                height={355}
                className="mx-auto mt-4 h-auto w-full max-w-[343px] xl:absolute xl:top-[107px] xl:right-[49px] xl:mt-0 xl:w-[45%]"
              />

              <form
                action="/api/heists/prepare"
                method="post"
                className="relative z-10 mt-5 w-full max-w-[292px] self-start xl:mt-0"
              >
                <Button
                  type="submit"
                  className="h-16 w-full cursor-pointer rounded-xl border-[3px] border-heist-ink bg-heist-yellow text-lg font-extrabold text-heist-ink shadow-heist-button hover:bg-heist-yellow/90"
                >
                  Start heist
                </Button>
              </form>
            </section>

            <div className="grid min-w-0 gap-[22px]">
              <section
                aria-label="Player summary"
                className={`${panel} flex min-h-[172px] items-start gap-5 p-6`}
              >
                <Image
                  src="/art/lobby-miko.svg"
                  alt=""
                  width={102}
                  height={102}
                  className="h-auto w-[76px] shrink-0 sm:w-[102px]"
                />
                <div className="min-w-0">
                  <h2 className="font-heist-display text-[30px] leading-none font-semibold wrap-anywhere">
                    {session.displayName}
                  </h2>
                  <p className={`${label} mt-5 text-heist-muted`}>Your ranked best</p>
                  <p className="mt-2 text-lg text-heist-yellow">No ranked time yet</p>
                </div>
              </section>

              <section
                aria-labelledby="recent-heists"
                className={`${panel} min-h-[200px] p-5 xl:min-h-[296px]`}
              >
                <h2 id="recent-heists" className="font-heist-display text-xl font-semibold uppercase">
                  Recent heists
                </h2>
                <p className="mt-6 text-heist-muted">No completed heists yet.</p>
              </section>
            </div>
          </div>

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-heist-muted xl:pr-12">
            <p>Signed in as {session.displayName}</p>
            <form action="/api/auth/logout" method="post">
              <Button
                type="submit"
                variant="ghost"
                className="cursor-pointer gap-4 text-heist-muted hover:bg-heist-panel hover:text-heist-cream"
              >
                Sign out
                <LogOut aria-hidden="true" className="size-[19px]" />
              </Button>
            </form>
          </footer>
        </main>
      </div>
    </div>
  );
}