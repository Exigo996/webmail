'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Download, Check, Loader2, Store, Puzzle, SwatchBook, Star, Eye, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { apiFetch } from '@/lib/browser-navigation';
import { compareVersions, isVersionSatisfied } from '@/lib/version-compare';

const CURRENT_APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';

interface Extension {
  slug: string;
  name: string;
  type: 'plugin' | 'theme';
  pluginType: string | null;
  description: string;
  permissions: string[];
  tags: string[];
  totalDownloads: number;
  featured: boolean;
  minAppVersion: string | null;
  latestVersion: string | null;
  installed: boolean;
  installedVersion: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  author: {
    displayName: string;
    githubLogin: string;
    avatarUrl: string | null;
  } | null;
}

interface SearchResult {
  data: Extension[];
  meta: {
    page: number;
    perPage: number;
    total: number;
  };
}

type TypeFilter = 'all' | 'plugin' | 'theme';

export function MarketplaceTab() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage] = useState(12);
  const [installing, setInstalling] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchExtensions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      params.set('sort', 'newest');

      const res = await apiFetch(`/api/admin/marketplace?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Nie udało się połączyć z katalogiem rozszerzeń');
        setExtensions([]);
        return;
      }

      const data: SearchResult = await res.json();
      setExtensions(data.data || []);
      setTotal(data.meta?.total || 0);
    } catch {
      setError('Nie udało się połączyć z katalogiem rozszerzeń. Upewnij się, że jest uruchomiony.');
      setExtensions([]);
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, page, perPage]);

  useEffect(() => {
    fetchExtensions();
  }, [fetchExtensions]);

  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function handleInstall(ext: Extension) {
    if (ext.minAppVersion && !isVersionSatisfied(CURRENT_APP_VERSION, ext.minAppVersion)) {
      setMessage({
        type: 'error',
        text: `"${ext.name}" wymaga aplikacji v${ext.minAppVersion}+. Używasz v${CURRENT_APP_VERSION}.`,
      });
      return;
    }
    const isUpdate = ext.installed;
    const targetVersion = ext.latestVersion || '1.0.0';
    setInstalling(ext.slug);
    setMessage(null);

    try {
      const res = await apiFetch('/api/admin/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: ext.slug,
          version: targetVersion,
          type: ext.type,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const warnings = data.warnings?.length ? ` (${data.warnings.length} ostrzeżenie(ń))` : '';
        setMessage({
          type: 'success',
          text: isUpdate
            ? `"${ext.name}" zaktualizowano do v${targetVersion}${warnings}`
            : `"${ext.name}" zainstalowano pomyślnie${warnings}`,
        });
        setExtensions(prev => prev.map(e =>
          e.slug === ext.slug
            ? { ...e, installed: true, installedVersion: targetVersion }
            : e,
        ));
      } else {
        setMessage({ type: 'error', text: data.error || (isUpdate ? 'Aktualizacja nie powiodła się' : 'Instalacja nie powiodła się') });
      }
    } catch {
      setMessage({ type: 'error', text: isUpdate ? 'Aktualizacja nie powiodła się - błąd sieci' : 'Instalacja nie powiodła się - błąd sieci' });
    } finally {
      setInstalling(null);
    }
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Rynek</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Przeglądaj i instaluj wtyczki i motywy z katalogu rozszerzeń BulwarkMail
        </p>
      </div>

      {message && (
        <div className={`text-sm rounded-md px-3 py-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Szukaj rozszerzeń..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-input bg-background p-0.5 self-start sm:self-auto">
          {(['all', 'plugin', 'theme'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setPage(1); }}
              className={`h-8 px-3 rounded text-sm font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'all' ? 'Wszystkie' : t === 'plugin' ? 'Wtyczki' : 'Motywy'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="border border-border rounded-lg p-12 text-center">
          <Store className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Uruchom serwer katalogu rozszerzeń na skonfigurowanym porcie
          </p>
          <button
            onClick={fetchExtensions}
            className="mt-4 inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Ponów
          </button>
        </div>
      )}

      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Wyszukiwanie rozszerzeń...</span>
        </div>
      )}

      {!loading && !error && extensions.length === 0 && (
        <div className="border border-border rounded-lg p-12 text-center">
          <Store className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nie znaleziono rozszerzeń</p>
          {query && (
            <p className="text-xs text-muted-foreground mt-1">
              Spróbuj innego hasła wyszukiwania
            </p>
          )}
        </div>
      )}

      {!loading && !error && extensions.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground">
            {total} znaleziono rozszerzeń
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {extensions.map((ext) => (
              <ExtensionCard
                key={ext.slug}
                extension={ext}
                installing={installing === ext.slug}
                onInstall={() => handleInstall(ext)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-3 rounded-md border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Poprzednia
              </button>
              <span className="text-sm text-muted-foreground">
                Strona {page} z {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-3 rounded-md border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Następna
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ExtensionCard({
  extension,
  installing,
  onInstall,
}: {
  extension: Extension;
  installing: boolean;
  onInstall: () => void;
}) {
  const isPlugin = extension.type === 'plugin';
  const previewHref = `/admin/marketplace/${encodeURIComponent(extension.slug)}`;
  const versionMismatch = !!extension.minAppVersion
    && !isVersionSatisfied(CURRENT_APP_VERSION, extension.minAppVersion);
  const updateAvailable = extension.installed
    && !!extension.installedVersion
    && !!extension.latestVersion
    && compareVersions(extension.latestVersion, extension.installedVersion) > 0
    && !versionMismatch;

  return (
    <div className="group relative border border-border rounded-lg overflow-hidden hover:border-ring/30 transition-colors">
      {extension.bannerUrl && (
        <Link href={previewHref} className="block focus:outline-none">
          <img
            src={extension.bannerUrl}
            alt=""
            className="block h-24 w-full object-cover border-b border-border"
            loading="lazy"
          />
        </Link>
      )}
      <Link href={previewHref} className="block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {extension.iconUrl ? (
              <img
                src={extension.iconUrl}
                alt=""
                className="w-10 h-10 object-cover"
                loading="lazy"
              />
            ) : isPlugin ? (
              <Puzzle className="w-5 h-5 text-muted-foreground" />
            ) : (
              <SwatchBook className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-foreground truncate group-hover:underline">
                {extension.name}
              </span>
              {extension.featured && (
                <Star className="w-3.5 h-3.5 text-warning shrink-0 fill-warning" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                isPlugin
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400'
              }`}>
                {isPlugin ? (extension.pluginType || 'wtyczka') : 'motyw'}
              </span>
              {extension.author && (
                <span className="text-xs text-muted-foreground truncate">
                  autor: {extension.author.displayName}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
          {extension.description}
        </p>

        {extension.tags && extension.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {extension.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {extension.totalDownloads.toLocaleString()}
            </span>
            {extension.permissions && extension.permissions.length > 0 && (
              <span title={extension.permissions.join(', ')}>
                {extension.permissions.length} uprawnień
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
            <Eye className="w-3 h-3" />
            Podgląd
          </span>
        </div>
      </Link>

      <div className="px-4 pb-4 -mt-1 flex items-center gap-2 flex-wrap">
        {extension.installed && updateAvailable ? (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInstall(); }}
            disabled={installing}
            title={`Aktualizuj z v${extension.installedVersion} do v${extension.latestVersion}`}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {installing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ArrowUpCircle className="w-3 h-3" />
            )}
            Aktualizuj do v{extension.latestVersion}
          </button>
        ) : extension.installed ? (
          <span
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs font-medium"
            title={extension.installedVersion ? `Zainstalowano: v${extension.installedVersion}` : undefined}
          >
            <Check className="w-3 h-3" />
            Zainstalowane
          </span>
        ) : versionMismatch ? (
          <span
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 text-xs font-medium"
            title={`Wymaga aplikacji v${extension.minAppVersion}+. Używasz v${CURRENT_APP_VERSION}.`}
          >
            <AlertTriangle className="w-3 h-3" />
            Wymaga v{extension.minAppVersion}+
          </span>
        ) : (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInstall(); }}
            disabled={installing}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {installing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            Szybka instalacja
          </button>
        )}
      </div>
    </div>
  );
}
