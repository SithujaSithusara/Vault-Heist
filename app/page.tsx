import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortalHeader } from '@/components/portal/portalHeader';
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
    <main className="grid min-h-svh w-full place-items-center bg-radial-[at_50%_35%] from-heist-panel to-heist-ink px-4 py-6 font-heist-body text-heist-cream sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-[1440px]">
        <PortalHeader />
      </div>
      <div className="grid w-full max-w-[1200px] overflow-hidden rounded-[28px] border border-heist-edge bg-heist-bg p-2 shadow-2xl sm:p-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section
          aria-labelledby="sign-in-title"
          className="flex min-w-0 flex-col px-5 py-6 sm:px-10 sm:py-8 lg:min-h-[620px] xl:px-12"
        >
          <div className="flex flex-1 flex-col justify-center pt-12 pb-8 lg:pb-16">
            <h1
              id="sign-in-title"
              className="font-heist-display text-[clamp(2.125rem,5vw,4.5rem)] leading-[1.05] font-semibold"
            >
              A Heist
              <br />
              For Your Fruit
            </h1>

            <p className="mt-5 text-lg leading-snug font-bold text-heist-muted sm:text-xl">
              Sneak in. Crack the code.
              <br />
              Get your fruit back.
            </p>

            <form
              action="/api/auth/google"
              method="get"
              className="mt-8 w-full max-w-[360px]"
            >
              <Button
                type="submit"
                className="h-14 w-full gap-3 rounded-xl border-[3px] border-heist-ink bg-heist-cream px-4 text-base font-extrabold text-heist-ink shadow-heist-button hover:bg-white focus-visible:ring-2 focus-visible:ring-heist-mint"
              >
                <Image
                  src="/art/google-mark.svg"
                  alt=""
                  width={24}
                  height={24}
                />
                Continue with Google
              </Button>
            </form>

            {auth === 'cancelled' && (
              <p role="status" className="mt-4 text-sm text-heist-muted">
                Sign-in was cancelled.
              </p>
            )}
            {auth === 'failed' && (
              <p role="alert" className="mt-4 text-sm text-heist-red">
                Sign-in failed. Please try again.
              </p>
            )}
          </div>
        </section>

        <div className="grid min-w-0 place-items-center overflow-hidden rounded-[20px] bg-linear-to-br from-[#35515a] via-heist-panel to-heist-bg px-3 py-2 sm:px-6 lg:py-0">
          <Image
            src="/art/login-vault.svg"
            alt=""
            width={590}
            height={600}
            className="h-auto w-full max-w-[590px]"
            loading="eager"
          />
        </div>
      </div>
    </main>
  );
}