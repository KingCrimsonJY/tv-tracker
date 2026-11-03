import React from 'react';
import { ExternalLink } from 'lucide-react';
import { zh } from '../../i18n/zh.ts';

export const AboutSection: React.FC = () => {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {zh.settings.about.label} · {zh.app.name}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {zh.app.tagline} · {zh.settings.about.versionLabel}
          </p>
        </div>
        <a
          href={zh.settings.about.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl text-xs font-medium border border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
        >
          <span>{zh.settings.about.githubLabel}</span>
          <ExternalLink className="w-3.5 h-3.5 text-[var(--muted)]" />
        </a>
      </div>

      <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center gap-3">
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="The Movie Database (TMDB)"
          className="shrink-0 inline-flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 185.04 133.4"
            className="h-5 w-auto"
            role="img"
            aria-label="TMDB Logo"
          >
            <defs>
              <linearGradient id="tmdb-grad" y1="66.7" x2="185.04" y2="66.7" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#90cea1" />
                <stop offset="0.56" stopColor="#3cbec9" />
                <stop offset="1" stopColor="#00b3e5" />
              </linearGradient>
            </defs>
            <path
              fill="url(#tmdb-grad)"
              d="M51.06,66.7h0A17.67,17.67,0,0,1,68.73,49h-.1A17.67,17.67,0,0,1,86.3,66.7h0A17.67,17.67,0,0,1,68.63,84.37h.1A17.67,17.67,0,0,1,51.06,66.7Zm82.67-31.33h32.9a17.67,17.67,0,0,0,17.67-17.67h0A17.67,17.67,0,0,0,166.63,0h-32.9A17.67,17.67,0,0,0,116.06,17.67h0A17.67,17.67,0,0,0,133.73,35.37Zm-116,98h63.9A17.67,17.67,0,0,0,99.3,115.7h0A17.67,17.67,0,0,0,81.63,98H17.73A17.67,17.67,0,0,0,.06,115.7h0A17.67,17.67,0,0,0,17.73,133.4Zm119.6-49h30a17.67,17.67,0,0,0,17.67-17.67h0A17.67,17.67,0,0,0,167.37,49h-30A17.67,17.67,0,0,0,119.7,66.7h0A17.67,17.67,0,0,0,137.33,84.37ZM17.67,35.37H35.9V84.37H51.2V35.37H69.43V20.07H17.67Zm75.1,49h14.4V44.77h.2l11.6,39.6h10.7l11.8-39.6h.2v39.6H156V20.07H136.07l-11.6,41.2h-.2l-11.4-41.2H92.77Zm66,49h16.6a25.09,25.09,0,0,0,9.67-1.75,20.23,20.23,0,0,0,7-4.85,20.73,20.73,0,0,0,4.25-7.35,28.84,28.84,0,0,0,1.45-9.35,27.18,27.18,0,0,0-1.45-9.05,19.93,19.93,0,0,0-4.25-7.15,19.47,19.47,0,0,0-7-4.7,25.84,25.84,0,0,0-9.67-1.65H158.77Zm15.3-32.7h3.4a13.43,13.43,0,0,1,4.65.75,9.32,9.32,0,0,1,3.5,2.2,9.67,9.67,0,0,1,2.2,3.55,14.89,14.89,0,0,1,0,9.65,9.67,9.67,0,0,1-2.2,3.55,9.32,9.32,0,0,1-3.5,2.2,13.43,13.43,0,0,1-4.65.75h-3.4Z"
            />
          </svg>
        </a>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {zh.settings.about.tmdbNotice}
        </p>
      </div>
    </section>
  );
};
