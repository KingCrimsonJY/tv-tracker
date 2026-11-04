import React, { useState } from 'react';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { Button } from '@heroui/react';
import { MediaImage } from '../../components/MediaImage';
import type { CustomTitleInput } from '../../context/TrackerContext';
import { importLinkApi } from '../../data/api';
import type { LinkImportResult } from '../../domain/types';
import { zh } from '../../i18n/zh';
import { ManualItemDialog } from './ManualItemDialog';

export type ParsedLinkSeed = LinkImportResult;

interface LinkImportDialogProps {
  onSearchTmdb: (query: string) => void;
  onSubmitCustomItem: (input: CustomTitleInput) => Promise<void>;
}

export const LinkImportDialog: React.FC<LinkImportDialogProps> = ({
  onSearchTmdb,
  onSubmitCustomItem,
}) => {
  const [linkUrl, setLinkUrl] = useState('');
  const [parsingLink, setParsingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<LinkImportResult | null>(
    null
  );
  const [forceLinkPreview, setForceLinkPreview] = useState(false);

  const handleParseLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = linkUrl.trim();
    if (!raw) return;
    setParsingLink(true);
    setLinkError(null);
    setForceLinkPreview(false);

    try {
      const result = await importLinkApi(raw);
      setParsedResult(result);
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
    <div className="space-y-5 max-w-xl">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
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
              type="text"
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

      {parsedResult?.warning && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-2.5 text-xs sm:text-sm text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{parsedResult.warning}</span>
        </div>
      )}

      {parsedResult &&
        parsedResult.kind === 'tmdb-suggestion' &&
        !forceLinkPreview && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
            <div className="flex items-start gap-4">
              {parsedResult.posterUrl && (
                <div className="w-20 shrink-0 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-secondary)]">
                  <MediaImage
                    src={parsedResult.posterUrl}
                    alt={parsedResult.title}
                    aspect="poster"
                    mediaType="tv"
                  />
                </div>
              )}
              <div className="space-y-1.5 min-w-0 flex-1">
                <h3 className="text-base font-semibold text-[var(--foreground)]">
                  {zh.search.linkImport.tmdbSuggestionTitle(parsedResult.title)}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                  {zh.search.linkImport.tmdbSuggestionDescription}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="primary"
                onPress={() => onSearchTmdb(parsedResult.title)}
                className="gap-2"
              >
                <Search className="w-4 h-4" />
                <span>
                  {zh.search.linkImport.searchTmdbButton(parsedResult.title)}
                </span>
              </Button>
              <Button
                variant="secondary"
                onPress={() => setForceLinkPreview(true)}
              >
                {zh.search.linkImport.addAsLinkAnywayButton}
              </Button>
            </div>
          </section>
        )}

      {parsedResult &&
        (parsedResult.kind !== 'tmdb-suggestion' || forceLinkPreview) && (
          <ManualItemDialog
            initialSeed={parsedResult}
            onSubmitCustomItem={onSubmitCustomItem}
          />
        )}
    </div>
  );
};
