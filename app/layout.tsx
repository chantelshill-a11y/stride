import type { Metadata } from 'next';
import './globals.css';

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        className="block py-2 text-[0.7rem] sm:text-[0.72rem] uppercase tracking-[0.12em] sm:tracking-[0.16em] font-medium text-[color:var(--charcoal-soft)] hover:text-[color:var(--charcoal)] transition-colors whitespace-nowrap"
      >
        {children}
      </a>
    </li>
  );
}

export const metadata: Metadata = {
  title: 'Stride — Multi-Agent Orchestration for Project Managers',
  description:
    'A daily-driver tool for PMs: morning briefs, meeting artifacts, and a persistent project status tracker, orchestrated by specialized agents with human-in-the-loop control throughout.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="border-b border-[color:var(--rule)] bg-[color:var(--cream)] nav-top">
          <div className="mx-auto max-w-6xl px-6 sm:px-8 py-4 sm:py-5 flex items-baseline justify-between gap-4 flex-wrap">
            <div className="nav-brand flex items-baseline gap-3">
              <a
                href="https://chantelhill.com"
                className="nav-portfolio-link serif font-bold text-[0.92rem] text-[color:var(--charcoal-soft)] hover:text-[color:var(--charcoal)] transition-colors"
              >
                Chantel Hill
              </a>
              <span className="nav-separator text-[color:var(--rule)] font-normal">/</span>
              <a
                href="/"
                className="nav-logo serif font-bold text-base text-[color:var(--charcoal)] hover:text-[color:var(--charcoal)] transition-colors"
              >
                Stride
              </a>
            </div>
            <ul className="nav-links flex items-center flex-wrap gap-x-6 sm:gap-x-7 gap-y-1 list-none">
              <NavLink href="/brief">Morning Brief</NavLink>
              <NavLink href="/meeting">Meeting Mode</NavLink>
              <NavLink href="/notes">Notes</NavLink>
              <NavLink href="/tracker">Status Tracker</NavLink>
              <NavLink href="/about">About</NavLink>
            </ul>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-[color:var(--charcoal-mute)]">
          <hr className="rule mb-6" />
          <div className="flex justify-between">
            <span>Stride is a portfolio project by Chantel Hill.</span>
            <span>Multi-agent orchestration with HITL control.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
