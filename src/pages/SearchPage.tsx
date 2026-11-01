import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  FilePlus2,
  FolderPlus,
  Link2,
  Loader2,
  Plus,
  Search as SearchIcon,
} from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { MediaImage } from '../components/MediaImage';
import { useTracker } from '../context/TrackerContext';
import { SEED_CATALOG } from '../data/seedCatalog';
import type { MediaType } from '../domain/types';
import { zh } from '../i18n/zh';

interface SearchResultItem {
  sourceId: string;
  mediaType: 'movie' | 'tv';
  titleZh: string;
  titleOriginal: string;
  year: number | null;
  posterUrl: string | null;
  overview: string;
}

function getLocalFallbackResults(rawQuery: string): SearchResultItem[] {
  const qLower = rawQuery.trim().toLowerCase();
  const items = !qLower
    ? SEED_CATALOG
    : SEED_CATALOG.filter((item) => {
        const zhName = (item.title.names.zh || '').toLowerCase();
        const orig = (item.title.names.original || '').toLowerCase();
        const en = (item.title.names.en || '').toLowerCase();
        return zhName.includes(qLower) || orig.includes(qLower) || en.includes(qLower);
      });

  return items.map((item) => ({
    sourceId: item.tmdbId,
    mediaType: item.mediaType,
    titleZh: item.title.names.zh || item.title.names.original,
    titleOriginal: item.title.names.original,
    year: item.title.year,
    posterUrl: item.title.posterPath,
    overview: item.title.overview.zh || item.title.overview.en || '',
  }));
}

export const SearchPage: React.FC = () => {
  const { titles, lists, addTitleFromTmdb, createCustomOrLinkTitle } = useTracker();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>(() => getLocalFallbackResults(''));
  const [loading, setLoading] = useState(false);
  const [fromFallback, setFromFallback] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Target item for "Add straight into a list" modal
  const [listPickerItem, setListPickerItem] = useState<SearchResultItem | null>(null);

  // Link Import Modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkFetching, setLinkFetching] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Manual / Custom Item Modal (also opened after Link Import parses metadata)
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customSource, setCustomSource] = useState<'url' | 'custom'>('custom');
  const [customSourceUrl, setCustomSourceUrl] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customOriginalName, setCustomOriginalName] = useState('');
  const [customType, setCustomType] = useState<MediaType>('tv');
  const [customYear, setCustomYear] = useState('');
  const [customRuntime, setCustomRuntime] = useState('');
  const [customEpisodeCount, setCustomEpisodeCount] = useState('12');
  const [customPosterUrl, setCustomPosterUrl] = useState('');
  const [customOverview, setCustomOverview] = useState('');
  const [customTargetListId, setCustomTargetListId] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(query.trim())}`, {
          headers: { Accept: 'application/json' },
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          if (active) {
            setResults(getLocalFallbackResults(query));
            setFromFallback(true);
          }
          return;
        }
        const data = (await res.json()) as {
          results?: SearchResultItem[];
          fromFallback?: boolean;
        };
        if (active) {
          setResults(Array.isArray(data.results) ? data.results : getLocalFallbackResults(query));
          setFromFallback(Boolean(data.fromFallback));
        }
      } catch {
        if (active) {
          setResults(getLocalFallbackResults(query));
          setFromFallback(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 260);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleOneTapAdd = async (item: SearchResultItem, targetListId?: string) => {
    const key = `${item.mediaType}_${item.sourceId}`;
    setAddingId(key);
    try {
      await addTitleFromTmdb(item.mediaType, item.sourceId, targetListId);
    } finally {
      setAddingId(null);
      setListPickerItem(null);
    }
  };

  const openBlankManualModal = () => {
    setCustomSource('custom');
    setCustomSourceUrl(null);
    setCustomName(query.trim());
    setCustomOriginalName('');
    setCustomType('tv');
    setCustomYear(String(new Date().getFullYear()));
    setCustomRuntime('');
    setCustomEpisodeCount('12');
    setCustomPosterUrl('');
    setCustomOverview('');
    setCustomTargetListId('');
    setCustomModalOpen(true);
  };

  const handleFetchLinkInfo = async () => {
    const rawUrl = linkUrlInput.trim();
    if (!rawUrl) {
      setLinkError('请输入有效的网页或视频链接');
      return;
    }
    setLinkError('');
    setLinkFetching(true);
    try {
      const res = await fetch('/api/import/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ url: rawUrl }),
      });
      const data = (await res.json()) as {
        sourceUrl?: string;
        title?: string;
        posterUrl?: string | null;
        overview?: string;
        suggestedMediaType?: MediaType;
        error?: string;
      };
      if (!res.ok) {
        setLinkError(data.error || '无法解析该链接，请直接手动填写');
        return;
      }

      setLinkModalOpen(false);
      setCustomSource('url');
      setCustomSourceUrl(data.sourceUrl || rawUrl);
      setCustomName(data.title || rawUrl);
      setCustomOriginalName('');
      setCustomType(data.suggestedMediaType || 'other');
      setCustomYear(String(new Date().getFullYear()));
      setCustomRuntime('');
      setCustomEpisodeCount('1');
      setCustomPosterUrl(data.posterUrl || '');
      setCustomOverview(data.overview || '');
      setCustomTargetListId('');
      setCustomModalOpen(true);
    } catch {
      setLinkError('解析失败，请检查链接格式或改用手动添加');
    } finally {
      setLinkFetching(false);
    }
  };

  const handleSaveCustomTitle = async () => {
    if (!customName.trim()) return;
    setSavingCustom(true);
    try {
      const epCount =
        customType === 'movie'
          ? 0
          : Math.max(0, Number.parseInt(customEpisodeCount, 10) || 0);
      const created = await createCustomOrLinkTitle({
        source: customSource,
        sourceId: customSourceUrl,
        name: customName.trim(),
        originalName: customOriginalName.trim() || undefined,
        mediaType: customType,
        posterUrl: customPosterUrl.trim() || null,
        overview: customOverview.trim() || undefined,
        year: customYear ? Number.parseInt(customYear, 10) || null : null,
        runtimeMin: customRuntime ? Number.parseInt(customRuntime, 10) || null : null,
        episodeCount: epCount,
        targetListId: customTargetListId || undefined,
      });
      setCustomModalOpen(false);
      navigate(`/title/${created.id}`);
    } finally {
      setSavingCustom(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {zh.search.title}
          </h1>

          {/* Secondary Actions: Link Import & Manual Item */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLinkUrlInput('');
                setLinkError('');
                setLinkModalOpen(true);
              }}
              className="min-h-[44px] px-3.5 rounded-xl bg-[#1a1a1f] hover:bg-white/[0.08] border border-white/10 text-xs sm:text-sm font-medium text-[#e5e7eb] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Link2 className="w-4 h-4 text-[#60a5fa]" />
              <span>{zh.search.importByLink}</span>
            </button>

            <button
              type="button"
              onClick={openBlankManualModal}
              className="min-h-[44px] px-3.5 rounded-xl bg-[#1a1a1f] hover:bg-white/[0.08] border border-white/10 text-xs sm:text-sm font-medium text-[#e5e7eb] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <FilePlus2 className="w-4 h-4 text-[#60a5fa]" />
              <span>{zh.search.addManualItem}</span>
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative max-w-2xl">
          <SearchIcon className="w-5 h-5 text-[#9ca3af] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={zh.search.placeholder}
            aria-label={zh.search.title}
            className="w-full h-12 pl-12 pr-4 rounded-2xl bg-[#1a1a1f] border border-white/10 text-sm sm:text-base text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#3b82f6] transition-colors"
          />
          {loading && (
            <Loader2 className="w-4 h-4 text-[#60a5fa] animate-spin absolute right-4 top-1/2 -translate-y-1/2" />
          )}
        </div>

        {fromFallback && (
          <p className="text-xs text-[#9ca3af] max-w-2xl">
            {zh.search.tokenMissingHint}
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[#9ca3af]">
          {query.trim() ? `“${query.trim()}” 的搜索结果` : zh.search.featuredHeading}
        </h2>

        {results.length === 0 && !loading ? (
          <div className="py-14 text-center space-y-3">
            <p className="text-sm text-[#9ca3af]">{zh.search.noResults}</p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" onPress={openBlankManualModal}>
                {zh.search.addManualItem}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {results.map((item) => {
              const titleId = `tmdb_${item.mediaType}_${item.sourceId}`;
              const isInLibrary = Boolean(titles[titleId]);
              const busy = addingId === `${item.mediaType}_${item.sourceId}`;
              const showOriginal =
                item.titleOriginal &&
                item.titleOriginal.trim() !== item.titleZh.trim();

              return (
                <div
                  key={titleId}
                  className="flex items-center gap-3.5 sm:gap-4 p-3 rounded-2xl border border-white/[0.07] bg-[#1a1a1f] hover:bg-[#202027] transition-colors"
                >
                  {/* Poster */}
                  <div className="w-16 sm:w-20 shrink-0 rounded-xl overflow-hidden border border-white/[0.06]">
                    <MediaImage
                      src={item.posterUrl}
                      alt={item.titleZh}
                      aspect="poster"
                      mediaType={item.mediaType}
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1 space-y-1">
                    {isInLibrary ? (
                      <Link
                        to={`/title/${titleId}`}
                        className="text-base font-semibold text-white hover:text-[#60a5fa] transition-colors line-clamp-1"
                      >
                        {item.titleZh}
                      </Link>
                    ) : (
                      <h3 className="text-base font-semibold text-white line-clamp-1">
                        {item.titleZh}
                      </h3>
                    )}

                    {showOriginal && (
                      <p className="text-xs text-[#9ca3af] line-clamp-1">
                        {item.titleOriginal}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-[#9ca3af] tabular-nums">
                      {item.year && <span>{item.year}</span>}
                      {item.year && <span aria-hidden="true">·</span>}
                      <span>{zh.detail.mediaTypes[item.mediaType]}</span>
                    </div>

                    {item.overview && (
                      <p className="text-xs text-[#9ca3af] line-clamp-2 pt-0.5 leading-relaxed">
                        {item.overview}
                      </p>
                    )}
                  </div>

                  {/* Actions: One tap on "+" adds to library; secondary button adds straight into a list */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {Object.keys(lists).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setListPickerItem(item)}
                        aria-label={`将 ${item.titleZh} 加入列表`}
                        title={zh.search.addToList}
                        className="min-w-[44px] min-h-[44px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-[#d1d5db] flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <FolderPlus className="w-4 h-4" />
                      </button>
                    )}

                    {isInLibrary ? (
                      <Link
                        to={`/title/${titleId}`}
                        aria-label={`${item.titleZh} ${zh.search.inLibrary}`}
                        className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#10b981]/15 text-[#10b981] flex items-center justify-center gap-1 text-xs font-medium"
                      >
                        <Check className="w-4 h-4" />
                        <span className="hidden sm:inline">{zh.search.inLibrary}</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleOneTapAdd(item)}
                        aria-label={`将 ${item.titleZh} ${zh.search.addToLibrary}`}
                        className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white flex items-center justify-center gap-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{zh.search.addToLibrary}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal: Add straight into a list */}
      <Modal.Backdrop
        isOpen={Boolean(listPickerItem)}
        onOpenChange={(open) => !open && setListPickerItem(null)}
        isDismissable
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 text-white outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                将「{listPickerItem?.titleZh}」加入列表
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-4 space-y-2">
              {Object.values(lists).map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => listPickerItem && handleOneTapAdd(listPickerItem, list.id)}
                  className="w-full p-3 rounded-xl bg-[#141418] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between text-left transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{list.name}</p>
                    <p className="text-xs text-[#9ca3af]">
                      {list.kind === 'ordered' ? zh.lists.orderedType : zh.lists.collectionType}
                    </p>
                  </div>
                  <Plus className="w-4 h-4 text-[#60a5fa]" />
                </button>
              ))}
            </Modal.Body>
            <Modal.Footer className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onPress={() => setListPickerItem(null)}>
                {zh.app.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Modal: Import by Link */}
      <Modal.Backdrop
        isOpen={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        isDismissable
      >
        <Modal.Container size="md" placement="center">
          <Modal.Dialog className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 text-white outline-none">
            <Modal.Header>
              <Modal.Heading className="text-lg font-semibold">
                {zh.search.linkModal.title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-4 space-y-4">
              <div>
                <label className="block text-xs text-[#9ca3af] mb-1.5">
                  {zh.search.linkModal.urlLabel}
                </label>
                <input
                  type="url"
                  value={linkUrlInput}
                  onChange={(e) => {
                    setLinkUrlInput(e.target.value);
                    setLinkError('');
                  }}
                  placeholder={zh.search.linkModal.urlPlaceholder}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#141418] border border-white/10 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                />
                {linkError && (
                  <p className="mt-1.5 text-xs text-[#ef4444]">{linkError}</p>
                )}
              </div>
              <p className="text-xs text-[#9ca3af] leading-relaxed">
                系统将通过 YouTube oEmbed 或网页 Open Graph 标签自动提取标题、封面图与简介，解析后你仍可自由修改并设置集数。
              </p>
            </Modal.Body>
            <Modal.Footer className="mt-6 flex justify-end gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setLinkModalOpen(false)}
              >
                {zh.detail.editModal.cancel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isDisabled={linkFetching || !linkUrlInput.trim()}
                onPress={handleFetchLinkInfo}
              >
                {linkFetching
                  ? zh.search.linkModal.fetching
                  : zh.search.linkModal.fetchButton}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Modal: Manual / Editable Custom Item */}
      <Modal.Backdrop
        isOpen={customModalOpen}
        onOpenChange={setCustomModalOpen}
        isDismissable
      >
        <Modal.Container size="md" placement="center">
          <Modal.Dialog className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 text-white outline-none max-h-[90vh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading className="text-lg font-semibold">
                {customSource === 'url' ? '确认并编辑链接导入条目' : zh.search.manualModal.title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs text-[#9ca3af] mb-1">
                  {zh.detail.editModal.nameLabel} *
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="输入作品名称…"
                  className="w-full h-10 px-3 rounded-xl bg-[#141418] border border-white/10 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#9ca3af] mb-1">
                  {zh.detail.editModal.originalNameLabel}
                </label>
                <input
                  type="text"
                  value={customOriginalName}
                  onChange={(e) => setCustomOriginalName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#141418] border border-white/10 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs text-[#9ca3af] mb-1">
                    {zh.detail.editModal.mediaTypeLabel}
                  </label>
                  <select
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value as MediaType)}
                    className="w-full h-10 px-2.5 rounded-xl bg-[#141418] border border-white/10 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                  >
                    <option value="movie">{zh.detail.mediaTypes.movie}</option>
                    <option value="tv">{zh.detail.mediaTypes.tv}</option>
                    <option value="other">{zh.detail.mediaTypes.other}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[#9ca3af] mb-1">
                    {zh.detail.editModal.yearLabel}
                  </label>
                  <input
                    type="number"
                    value={customYear}
                    onChange={(e) => setCustomYear(e.target.value)}
                    placeholder="2025"
                    className="w-full h-10 px-3 rounded-xl bg-[#141418] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#3b82f6]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#9ca3af] mb-1">
                    {zh.detail.editModal.runtimeLabel}
                  </label>
                  <input
                    type="number"
                    value={customRuntime}
                    onChange={(e) => setCustomRuntime(e.target.value)}
                    placeholder="45"
                    className="w-full h-10 px-3 rounded-xl bg-[#141418] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#3b82f6]"
                  />
                </div>
              </div>

              {customType !== 'movie' && (
                <div>
                  <label className="block text-xs text-[#9ca3af] mb-1">
                    {zh.detail.editModal.episodeCountLabel}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={customEpisodeCount}
                    onChange={(e) => setCustomEpisodeCount(e.target.value)}
                    placeholder="例如 12（留空或 0 表示单集视频）"
                    className="w-full h-10 px-3 rounded-xl bg-[#141418] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#3b82f6]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-[#9ca3af] mb-1">
                  {zh.detail.editModal.posterUrlLabel}
                </label>
                <input
                  type="url"
                  value={customPosterUrl}
                  onChange={(e) => setCustomPosterUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-10 px-3 rounded-xl bg-[#141418] border border-white/10 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#9ca3af] mb-1">
                  {zh.detail.editModal.overviewLabel}
                </label>
                <textarea
                  rows={3}
                  value={customOverview}
                  onChange={(e) => setCustomOverview(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#141418] border border-white/10 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                />
              </div>

              {Object.keys(lists).length > 0 && (
                <div>
                  <label className="block text-xs text-[#9ca3af] mb-1">
                    同时加入列表（可选）
                  </label>
                  <select
                    value={customTargetListId}
                    onChange={(e) => setCustomTargetListId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#141418] border border-white/10 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                  >
                    <option value="">不加入列表</option>
                    {Object.values(lists).map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="mt-6 flex justify-end gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setCustomModalOpen(false)}
              >
                {zh.detail.editModal.cancel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isDisabled={savingCustom || !customName.trim()}
                onPress={handleSaveCustomTitle}
              >
                {zh.search.manualModal.submit}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
