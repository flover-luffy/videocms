import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="relative min-h-screen text-slate-50">
      <div className="aura-background" />

      <main
        id="main-content"
        role="main"
        tabIndex={-1}
        className="relative z-10 mx-auto flex min-h-screen max-w-[560px] items-center justify-center px-4 py-16 sm:px-6 sm:py-20"
      >
        <section className="glass fade-in-up relative w-full overflow-hidden rounded-[2rem] p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

          <div className="mb-6 space-y-2">
            {eyebrow ? (
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-black text-white sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="text-sm leading-6 text-slate-400">{description}</p>
            ) : null}
          </div>

          <div className="space-y-6">{children}</div>

          {footer ? (
            <div className="mt-6 border-t border-white/10 pt-5 text-sm text-slate-400">
              {footer}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
