'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Save, Loader2, RotateCcw, ImageIcon, Upload, Trash2, Globe, Plus, X } from 'lucide-react';
import { apiFetch, withBasePath } from '@/lib/browser-navigation';
import {
  BRANDING_OVERRIDE_KEYS,
  parseDomainBranding,
  type BrandingOverrideKey,
  type DomainBrandingEntry,
} from '@/lib/admin/domain-branding';

interface ConfigEntry {
  value?: unknown;
  source: 'admin' | 'env' | 'default';
  hasValue?: boolean;
}

const IMAGE_FIELDS = [
  { key: 'faviconUrl', label: 'Favicon', accept: '.svg,.png,.ico,.webp' },
  { key: 'appLogoLightUrl', label: 'Logo aplikacji (tryb jasny)', accept: '.svg,.png,.jpg,.webp' },
  { key: 'appLogoDarkUrl', label: 'Logo aplikacji (tryb ciemny)', accept: '.svg,.png,.jpg,.webp' },
  { key: 'loginLogoLightUrl', label: 'Logo logowania (tryb jasny)', accept: '.svg,.png,.jpg,.webp' },
  { key: 'loginLogoDarkUrl', label: 'Logo logowania (tryb ciemny)', accept: '.svg,.png,.jpg,.webp' },
] as const;

const TEXT_FIELDS = [
  { key: 'loginCompanyName', label: 'Nazwa firmy' },
  { key: 'loginImprintUrl', label: 'URL impressum' },
  { key: 'loginPrivacyPolicyUrl', label: 'URL polityki prywatności' },
  { key: 'loginWebsiteUrl', label: 'URL strony firmy' },
] as const;

const PWA_IMAGE_FIELDS = [
  { key: 'pwaIconUrl', label: 'Ikona PWA', accept: '.svg,.png,.jpg,.webp' },
  { key: 'pwaScreenshotMobileUrl', label: 'Zrzut ekranu PWA (mobilny)', accept: '.png,.jpg,.webp' },
  { key: 'pwaScreenshotDesktopUrl', label: 'Zrzut ekranu PWA (stacjonarny)', accept: '.png,.jpg,.webp' },
] as const;

const PWA_TEXT_FIELDS = [
  { key: 'appShortName', label: 'Krótka nazwa', placeholder: 'Wyświetlane na ekranie głównym (maks. ~12 znaków)' },
  { key: 'appDescription', label: 'Opis', placeholder: 'Opis aplikacji dla monitów instalacji' },
] as const;

const PWA_COLOR_FIELDS = [
  { key: 'pwaThemeColor', label: 'Kolor motywu', defaultValue: '#ffffff' },
  { key: 'pwaBackgroundColor', label: 'Kolor tła', defaultValue: '#ffffff' },
] as const;

// Accepts exact hosts and one-level wildcards (e.g. *.example.com).
const HOST_RE = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
// Tighter rule for uploads: wildcards can only point to externally-hosted
// URLs, since we'd have no concrete subdomain to serve a file from.
const EXACT_HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

export function BrandingTab() {
  const [config, setConfig] = useState<Record<string, ConfigEntry>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [addingHost, setAddingHost] = useState(false);
  const [newHostInput, setNewHostInput] = useState('');
  const [newHostError, setNewHostError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const domainEntries = useMemo<DomainBrandingEntry[]>(
    () => parseDomainBranding(config['domainBranding']?.value),
    [config],
  );

  // Drop selection if the host disappeared from the config (e.g. concurrent edit).
  useEffect(() => {
    if (selectedHost && !domainEntries.some(e => e.host === selectedHost)) {
      setSelectedHost(null);
      setEdits({});
    }
  }, [domainEntries, selectedHost]);

  async function fetchConfig() {
    setLoading(true);
    const res = await apiFetch('/api/admin/config');
    if (res.ok) setConfig(await res.json());
    setLoading(false);
  }

  function selectedEntry(): DomainBrandingEntry | null {
    if (!selectedHost) return null;
    return domainEntries.find(e => e.host === selectedHost) ?? null;
  }

  function handleChange(key: string, value: string) {
    setEdits(prev => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  function currentValue(key: string): string {
    if (key in edits) return edits[key];
    if (selectedHost) {
      const entry = selectedEntry();
      return (entry?.[key as BrandingOverrideKey] as string | undefined) ?? '';
    }
    return (config[key]?.value as string) ?? '';
  }

  function isOverriddenInScope(key: string): boolean {
    if (selectedHost) {
      const entry = selectedEntry();
      const v = entry?.[key as BrandingOverrideKey];
      return typeof v === 'string' && v.length > 0;
    }
    return config[key]?.source === 'admin';
  }

  const isUploadedFile = (key: string): boolean => {
    const val = currentValue(key);
    return val.startsWith('/api/admin/branding/');
  };

  function buildUpdatedDomainBranding(merge: Record<string, string>): DomainBrandingEntry[] {
    if (!selectedHost) return domainEntries;
    const next = domainEntries.slice();
    const idx = next.findIndex(e => e.host === selectedHost);
    const base: DomainBrandingEntry =
      idx === -1 ? { host: selectedHost } : { ...next[idx] };
    const writable = base as unknown as Record<string, string | undefined>;
    for (const [key, value] of Object.entries(merge)) {
      if (!(BRANDING_OVERRIDE_KEYS as readonly string[]).includes(key)) continue;
      if (typeof value === 'string' && value.length > 0) {
        writable[key] = value;
      } else {
        delete writable[key];
      }
    }
    if (idx === -1) next.push(base);
    else next[idx] = base;
    return next;
  }

  async function handleSave() {
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    setMessage(null);

    const payload = selectedHost
      ? { domainBranding: buildUpdatedDomainBranding(edits) }
      : edits;

    const res = await apiFetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setMessage({
        type: 'success',
        text: selectedHost
          ? `Branding dla ${selectedHost} zaktualizowany. Zmiany widoczne przy następnym załadowaniu strony.`
          : 'Branding zaktualizowany. Zmiany widoczne przy następnym załadowaniu strony.',
      });
      setEdits({});
      await fetchConfig();
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: data.error || 'Nie udało się zapisać' });
    }
    setSaving(false);
  }

  async function handleUpload(slot: string, file: File) {
    if (selectedHost && !EXACT_HOST_RE.test(selectedHost)) {
      setMessage({
        type: 'error',
        text: 'Hosty z symbolem wieloznacznym nie mogą przesyłać plików. Wprowadź URL.',
      });
      return;
    }
    setUploading(slot);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('slot', slot);
    if (selectedHost) formData.append('host', selectedHost);

    const res = await apiFetch('/api/admin/branding', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      setMessage({ type: 'success', text: `Przesłano ${file.name} pomyślnie.` });
      setEdits(prev => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
      // Refresh from server so domainBranding entries reflect the upload.
      await fetchConfig();
      void data;
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: data.error || 'Przesyłanie nie powiodło się' });
    }
    setUploading(null);
  }

  async function handleDeleteUpload(slot: string) {
    setMessage(null);

    const body: { slot: string; host?: string } = { slot };
    if (selectedHost) body.host = selectedHost;

    const res = await apiFetch('/api/admin/branding', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setMessage({ type: 'success', text: 'Przesłany plik usunięty. Przywrócono domyślne.' });
      setEdits(prev => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });
      await fetchConfig();
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: data.error || 'Nie udało się usunąć' });
    }
  }

  async function handleRevert(key: string) {
    if (selectedHost) {
      // Domain scope: drop the field from the entry and PATCH the array.
      const updated = buildUpdatedDomainBranding({ [key]: '' });
      const res = await apiFetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainBranding: updated }),
      });
      if (res.ok) {
        setEdits(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        await fetchConfig();
      }
      return;
    }
    // Default scope: revert via DELETE /api/admin/config
    const res = await apiFetch('/api/admin/config', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (res.ok) {
      setEdits(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await fetchConfig();
    }
  }

  async function handleAddDomain() {
    const host = newHostInput.trim().toLowerCase().replace(/\.+$/, '');
    if (!host) {
      setNewHostError('Wprowadź nazwę hosta');
      return;
    }
    if (!HOST_RE.test(host)) {
      setNewHostError('Nieprawidłowa nazwa hosta. Użyj foo.example.com lub *.example.com');
      return;
    }
    if (domainEntries.some(e => e.host === host)) {
      setNewHostError('Wpis brandingowy dla tego hosta już istnieje');
      return;
    }
    setNewHostError(null);

    const next: DomainBrandingEntry[] = [...domainEntries, { host }];
    const res = await apiFetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainBranding: next }),
    });
    if (res.ok) {
      setNewHostInput('');
      setAddingHost(false);
      setSelectedHost(host);
      setEdits({});
      await fetchConfig();
    } else {
      const data = await res.json();
      setNewHostError(data.error || 'Nie udało się dodać domeny');
    }
  }

  async function handleDeleteDomain() {
    if (!selectedHost) return;
    if (!confirm(`Usunąć wpis brandingowy dla ${selectedHost}? Przesłane pliki dla tej domeny pozostaną na dysku.`)) {
      return;
    }
    const next = domainEntries.filter(e => e.host !== selectedHost);
    const res = await apiFetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainBranding: next }),
    });
    if (res.ok) {
      setSelectedHost(null);
      setEdits({});
      await fetchConfig();
      setMessage({ type: 'success', text: `Usunięto wpis brandingowy dla ${selectedHost}.` });
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: data.error || 'Nie udało się usunąć domeny' });
    }
  }

  function handleScopeChange(host: string | null) {
    if (Object.keys(edits).length > 0 && !confirm('Odrzucić niezapisane zmiany?')) return;
    setSelectedHost(host);
    setEdits({});
    setMessage(null);
  }

  const hasEdits = Object.keys(edits).length > 0;
  const wildcardScope = !!selectedHost && !EXACT_HOST_RE.test(selectedHost);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Ładowanie...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Branding</h1>
          <p className="text-sm text-muted-foreground mt-1">Dostosuj loga, favicon i informacje o firmie</p>
        </div>
        {hasEdits && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Zapisz zmiany
          </button>
        )}
      </div>

      {/* Scope picker */}
      <div className="border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Zakres</h2>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleScopeChange(null)}
              className={`h-8 px-3 rounded-md text-sm font-medium transition-colors ${
                selectedHost === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted/70'
              }`}
            >
              Domyślne
            </button>
            {domainEntries.map(entry => (
              <button
                key={entry.host}
                type="button"
                onClick={() => handleScopeChange(entry.host)}
                className={`h-8 px-3 rounded-md text-sm font-medium transition-colors ${
                  selectedHost === entry.host
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/70'
                }`}
              >
                {entry.host}
              </button>
            ))}
            {!addingHost && (
              <button
                type="button"
                onClick={() => { setAddingHost(true); setNewHostError(null); }}
                className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-dashed border-input text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Dodaj domenę
              </button>
            )}
          </div>
          {addingHost && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                autoFocus
                value={newHostInput}
                onChange={(e) => { setNewHostInput(e.target.value); setNewHostError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddDomain(); }}
                placeholder="mail.example.com or *.example.com"
                className="h-8 w-64 rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={handleAddDomain}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Dodaj
              </button>
              <button
                type="button"
                onClick={() => { setAddingHost(false); setNewHostInput(''); setNewHostError(null); }}
                className="h-8 px-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Anuluj
              </button>
              {newHostError && <span className="text-xs text-destructive">{newHostError}</span>}
            </div>
          )}
          {selectedHost ? (
            <div className="flex items-center justify-between gap-3 text-xs">
              <p className="text-muted-foreground">
                Edycja nadpisań dla <span className="font-mono text-foreground">{selectedHost}</span>.
                Nieustawione pola używają wartości domyślnych.
                {wildcardScope && ' Przesyłanie jest wyłączone dla hostów z symbolem wieloznacznym; wprowadź URL.'}
              </p>
              <button
                type="button"
                onClick={handleDeleteDomain}
                className="inline-flex items-center gap-1 text-destructive hover:underline whitespace-nowrap"
              >
                <X className="w-3.5 h-3.5" />
                Usuń domenę
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Edycja domyślnego brandingu. Dodaj domenę, aby nadpisać branding, gdy webmail jest obsługiwany na określonej nazwie hosta.
            </p>
          )}
        </div>
      </div>

      {message && (
        <div className={`text-sm rounded-md px-3 py-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-medium text-foreground">Obrazy i loga</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Prześlij plik lub wprowadź URL. Obsługiwane formaty: SVG, PNG, JPEG, WebP, ICO (maks. 2 MB)</p>
        </div>
        <div className="divide-y divide-border">
          {IMAGE_FIELDS.map(field => (
            <div key={field.key} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="text-sm text-foreground">{field.label}</label>
                  {isOverriddenInScope(field.key) && (
                    <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {isUploadedFile(field.key) ? 'przesłane' : selectedHost ? 'domena' : 'admin'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={currentValue(field.key)}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={selectedHost ? 'Wprowadź URL (przesyłanie tylko dla zakresu domyślnego)' : 'Wprowadź URL lub prześlij plik'}
                    className="h-8 w-full sm:w-64 min-w-0 rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <input
                    ref={el => { fileInputRefs.current[field.key] = el; }}
                    type="file"
                    accept={field.accept}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(field.key, file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => fileInputRefs.current[field.key]?.click()}
                    disabled={uploading === field.key || wildcardScope}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-input bg-background text-sm text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                    title={wildcardScope ? 'Przesyłanie wyłączone dla hostów z symbolem wieloznacznym' : 'Prześlij plik'}
                  >
                    {uploading === field.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  </button>
                  {isUploadedFile(field.key) && (
                    <button
                      onClick={() => handleDeleteUpload(field.key)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Usuń przesłany plik"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isOverriddenInScope(field.key) && !isUploadedFile(field.key) && (
                    <button onClick={() => handleRevert(field.key)} className="text-muted-foreground hover:text-foreground" title="Przywróć domyślne">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {currentValue(field.key) && (
                <div className="mt-2 flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="h-8 w-auto bg-muted rounded flex items-center justify-center px-2">
                    <img
                      src={withBasePath(currentValue(field.key))}
                      alt={field.label}
                      className="max-h-6 max-w-[200px] object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-medium text-foreground">Progresywna aplikacja webowa</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Wyświetlane, gdy użytkownicy instalują webmail na ekranie głównym. Pozostaw pola puste, aby użyć favicon i nazwy aplikacji.</p>
        </div>
        <div className="divide-y divide-border">
          {PWA_IMAGE_FIELDS.map(field => (
            <div key={field.key} className="px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="text-sm text-foreground">{field.label}</label>
                  {isOverriddenInScope(field.key) && (
                    <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {isUploadedFile(field.key) ? 'przesłane' : selectedHost ? 'domena' : 'admin'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={currentValue(field.key)}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={selectedHost ? 'Wprowadź URL (przesyłanie tylko dla zakresu domyślnego)' : 'Wprowadź URL lub prześlij plik'}
                    className="h-8 w-full sm:w-64 min-w-0 rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <input
                    ref={el => { fileInputRefs.current[field.key] = el; }}
                    type="file"
                    accept={field.accept}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(field.key, file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => fileInputRefs.current[field.key]?.click()}
                    disabled={uploading === field.key || wildcardScope}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-input bg-background text-sm text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                    title={wildcardScope ? 'Przesyłanie wyłączone dla hostów z symbolem wieloznacznym' : 'Prześlij plik'}
                  >
                    {uploading === field.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  </button>
                  {isUploadedFile(field.key) && (
                    <button
                      onClick={() => handleDeleteUpload(field.key)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Usuń przesłany plik"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isOverriddenInScope(field.key) && !isUploadedFile(field.key) && (
                    <button onClick={() => handleRevert(field.key)} className="text-muted-foreground hover:text-foreground" title="Przywróć domyślne">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {currentValue(field.key) && (
                <div className="mt-2 flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="h-8 w-auto bg-muted rounded flex items-center justify-center px-2">
                    <img
                      src={withBasePath(currentValue(field.key))}
                      alt={field.label}
                      className="max-h-6 max-w-[200px] object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {PWA_TEXT_FIELDS.map(field => (
            <div key={field.key} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <label className="text-sm text-foreground">{field.label}</label>
                {isOverriddenInScope(field.key) && (
                  <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {selectedHost ? 'domena' : 'admin'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={currentValue(field.key)}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="h-8 w-full sm:w-72 min-w-0 rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {isOverriddenInScope(field.key) && (
                  <button onClick={() => handleRevert(field.key)} className="text-muted-foreground hover:text-foreground" title="Przywróć domyślne">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {PWA_COLOR_FIELDS.map(field => {
            const value = currentValue(field.key) || field.defaultValue;
            return (
              <div key={field.key} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <label className="text-sm text-foreground">{field.label}</label>
                  {isOverriddenInScope(field.key) && (
                    <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {selectedHost ? 'domena' : 'admin'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : field.defaultValue}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded-md border border-input bg-background p-0.5"
                    title="Wybierz kolor"
                  />
                  <input
                    type="text"
                    value={currentValue(field.key)}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.defaultValue}
                    className="h-8 w-full sm:w-32 min-w-0 rounded-md border border-input bg-background px-2.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {isOverriddenInScope(field.key) && (
                    <button onClick={() => handleRevert(field.key)} className="text-muted-foreground hover:text-foreground" title="Przywróć domyślne">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-medium text-foreground">Informacje o firmie</h2>
        </div>
        <div className="divide-y divide-border">
          {TEXT_FIELDS.map(field => (
            <div key={field.key} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <label className="text-sm text-foreground">{field.label}</label>
                {isOverriddenInScope(field.key) && (
                  <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {selectedHost ? 'domena' : 'admin'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={currentValue(field.key)}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.key.includes('Url') ? 'https://...' : 'Wprowadź wartość'}
                  className="h-8 w-full sm:w-72 min-w-0 rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {isOverriddenInScope(field.key) && (
                  <button onClick={() => handleRevert(field.key)} className="text-muted-foreground hover:text-foreground" title="Przywróć domyślne">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
