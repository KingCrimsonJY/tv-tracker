import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { fetchSystemInfoApi } from '../../data/api.ts';
import { zh } from '../../i18n/zh.ts';

export const AboutSection: React.FC = () => {
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSystemInfoApi()
      .then((info) => {
        if (active) setYtdlpVersion(info.ytdlpVersion);
      })
      .catch(() => {
        if (active) setYtdlpVersion(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {zh.settings.about.label} · {zh.app.name}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5 tabular-nums">
            {zh.app.tagline} · {zh.settings.about.versionLabel} ·{' '}
            {zh.settings.about.ytdlpLabel}:{' '}
            {ytdlpVersion || zh.settings.about.ytdlpNotInstalled}
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

      <div className="pt-3 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center gap-3">
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="The Movie Database (TMDB)"
          className="shrink-0 inline-flex items-center"
        >
          <img
            src="/tmdb-logo.svg"
            alt="TMDB Logo"
            className="h-3.5 w-auto"
          />
        </a>
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          {zh.settings.about.tmdbNotice}
        </p>
      </div>
    </section>
  );
};
