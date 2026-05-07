import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stride — Multi-Agent Orchestration for Project Managers',
  description:
    'A daily-driver tool for PMs: morning briefs, meeting artifacts, and a persistent project status tracker, orchestrated by specialized agents with human-in-the-loop control throughout.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="border-b border-[color:var(--rule)] bg-[color:var(--cream)]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-5 flex items-baseline justify-between gap-4 flex-wrap">
            <a href="/" className="serif text-2xl text-[color:var(--forest)] tracking-tight">
              Stride
            </a>
            <nav className="flex items-center gap-x-5 gap-y-1 text-sm flex-wrap">
              <a href="/brief" className="hover:text-[color:var(--forest)] transition-colors whitespace-nowrap">Morning Brief</a>
              <a href="/meeting" className="hover:text-[color:var(--forest)] transition-colors whitespace-nowrap">Meeting Mode</a>
              <a href="/notes" className="hover:text-[color:var(--forest)] transition-colors">Notes</a>
              <a href="/tracker" className="hover:text-[color:var(--forest)] transition-colors whitespace-nowrap">Status Tracker</a>
              <a href="/about" className="hover:text-[color:var(--forest)] transition-colors">About</a>
            </nav>
          </div>
        </div>
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
