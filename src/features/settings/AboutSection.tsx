import React, { useEffect, useState } from 'react';
import { Card } from '@heroui/react';
import { Clapperboard, ExternalLink } from 'lucide-react';
import { fetchSystemInfoApi } from '../../data/api';
import { useI18n } from '../../i18n';

export const AboutSection: React.FC = () => {
  const { t } = useI18n();
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchSystemInfoApi()
      .then((info) => {
        if (mounted) {
          if (info.appVersion) setAppVersion(info.appVersion);
          setYtdlpVersion(info.ytdlpVersion);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Card>
      <Card.Header className="pb-2">
        <Card.Title className="text-base">{t.settings.about.label}</Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-accent-foreground shrink-0">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">{t.app.name}</div>
              <div className="text-xs text-[var(--muted)]">{t.app.tagline}</div>
            </div>
          </div>
          <a
            href="https://github.com/KingCrimsonJY/tv-tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] inline-flex items-center gap-1 transition-colors"
          >
            {t.settings.about.githubLabel}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex flex-col gap-2 text-xs text-[var(--muted)] pt-3 border-t border-[var(--border)]">
          <div className="flex items-center justify-between gap-4">
            <span>{t.settings.about.versionLabel}</span>
            {appVersion ? (
              <span className="font-mono text-[var(--foreground)]">{appVersion}</span>
            ) : (
              <span className="font-mono text-[var(--muted)]">—</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>{t.settings.about.ytdlpLabel}</span>
            <span className="font-mono text-[var(--foreground)]">
              {ytdlpVersion || t.settings.about.ytdlpNotInstalled}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--border)] flex flex-row items-center gap-3">
          <img
            src="/tmdb-logo.svg"
            alt="TMDB"
            className="h-3.5 w-auto shrink-0 opacity-90"
          />
          <p className="text-xs text-[var(--muted)] leading-relaxed min-w-0 flex-1">
            {t.settings.about.tmdbNotice}
          </p>
        </div>
      </Card.Content>
    </Card>
  );
};
