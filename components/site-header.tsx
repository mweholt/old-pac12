type SiteHeaderProps = {
  active: 'schedule' | 'standings';
  season?: number;
};

export function SiteHeader({ active, season }: SiteHeaderProps) {
  return (
    <header className="site-header sticky top-0 z-40">
      <div className="utility-bar">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
          <span>PAC-12 FOOTBALL</span>
          <span className="utility-live">Live data powered by ESPN</span>
        </div>
      </div>
      <div className="main-nav px-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5">
          <Link href="/" aria-label="Pac-12 schedule">
            <Image src="/pac12-wordmark.svg" alt="Pac-12 Conference" className="pac-logo" width={90} height={38} priority />
          </Link>
          <nav className="site-nav-links" aria-label="Primary navigation">
            <Link href="/" className={active === 'schedule' ? 'active' : ''}>Schedule</Link>
            <Link href="/standings" className={active === 'standings' ? 'active' : ''}>Standings</Link>
          </nav>
          <span className="season-label">{season ?? new Date().getFullYear()} season</span>
        </div>
      </div>
    </header>
  );
}
import Image from 'next/image';
import Link from 'next/link';
