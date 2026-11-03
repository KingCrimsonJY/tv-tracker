import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@heroui/react';
import { apiJson } from '../../data/api';
import { zh } from '../../i18n/zh';

export interface ParsedLinkSeed {
  title: string;
  posterUrl?: string;
  overview?: string;
  sourceUrl: string;
}

interface LinkImportDialogProps {
  onParsedSuccess: (seed: ParsedLinkSeed) => void;
}

export const LinkImportDialog: React.FC<LinkImportDialogProps> = ({
  onParsedSuccess,
}) => {
  const [linkUrl, setLinkUrl] = useState('');
  const [parsingLink, setParsingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleParseLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setParsingLink(true);
    setLinkError(null);

    try {
      const data = await apiJson<{
        title?: string;
        image?: string | null;
        description?: string;
        sourceUrl?: string;
      }>('/api/import-link', {
        method: 'POST',
        body: JSON.stringify({ url: linkUrl.trim() }),
      });
      onParsedSuccess({
        title: data.title || '',
        posterUrl: data.image || '',
        overview: data.description || '',
        sourceUrl: data.sourceUrl || linkUrl.trim(),
      });
    } catch (err) {
      setLinkError(
        err instanceof Error
          ? `${zh.search.linkImport.parseError}: ${err.message}`
          : zh.search.linkImport.parseError
      );
    } finally {
      setParsingLink(false);
    }
  };

  return (
    <section className="max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {zh.search.linkImport.title}
        </h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          {zh.search.linkImport.description}
        </p>
      </div>

      <form onSubmit={handleParseLink} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="link-import-url"
            className="block text-xs text-[var(--muted)]"
          >
            {zh.search.linkImport.urlLabel}
          </label>
          <input
            id="link-import-url"
            type="url"
            required
            value={linkUrl}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              setLinkError(null);
            }}
            placeholder={zh.search.linkImport.urlPlaceholder}
            className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
          />
          {linkError && (
            <p className="text-xs text-[var(--danger)]">{linkError}</p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          isDisabled={parsingLink}
          className="gap-2"
        >
          {parsingLink && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {parsingLink
              ? zh.search.linkImport.parsing
              : zh.search.linkImport.parseButton}
          </span>
        </Button>
      </form>
    </section>
  );
};
