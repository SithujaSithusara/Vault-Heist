import { Lock, Volume2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function PortalHeader() {
  return (
    <header className="flex flex-wrap items-center gap-x-8 gap-y-4 px-6 pt-8 sm:px-10 xl:px-14">
      <div className="flex items-center gap-2.5">
        <Lock aria-hidden="true" className="size-[30px] text-heist-yellow" />
        <span className="font-heist-display text-[30px] leading-[1.08] font-semibold">
          VAULT HEIST
        </span>
      </div>

      <nav
        aria-label="Portal navigation"
        className="flex flex-wrap items-center gap-5 text-sm font-extrabold text-heist-muted sm:ml-auto xl:gap-[60px]"
      >
        <button type="button" className="enabled:cursor-pointer disabled:cursor-not-allowed">HOW TO PLAY</button>
        <button type="button" className="enabled:cursor-pointer disabled:cursor-not-allowed">LEADERBOARD</button>
        <Button
          type="button"
          aria-label="Sound"
          disabled
          className="size-12 rounded-[14px] border-[3px] border-heist-edge bg-heist-panel p-0 text-heist-muted disabled:opacity-100 xl:ml-[60px]"
        >
          <Volume2 aria-hidden="true" className="size-[22px]" />
        </Button>
      </nav>
    </header>
  );
}