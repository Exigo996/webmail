'use client';

import { useEffect, useState, useRef } from 'react';
import { Upload, Trash2, Power, PowerOff, Loader2, Palette, Save, Shield, Lock, LockOpen } from 'lucide-react';
import type { SettingsPolicy } from '@/lib/admin/types';
import { DEFAULT_POLICY, DEFAULT_THEME_POLICY } from '@/lib/admin/types';
import { apiFetch } from '@/lib/browser-navigation';

const BUILTIN_THEME_OPTIONS = [
  { id: 'builtin-nord', name: 'Nord' },
  { id: 'builtin-catppuccin', name: 'Catppuccin' },
  { id: 'builtin-solarized', name: 'Solarized' },
];

interface ThemeEntry {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  variants: string[];
  enabled: boolean;
  forceEnabled?: boolean;
  installedAt: string;
  updatedAt: string;
}

export function ThemesTab() {
  const [themes, setThemes] = useState<ThemeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [policy, setPolicy] = useState<SettingsPolicy>({ ...DEFAULT_POLICY });
  const [policyDirty, setPolicyDirty] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => { fetchThemes(); fetchPolicy(); }, []);

  async function fetchPolicy() {
    try {
      const res = await apiFetch('/api/admin/policy');
      if (res.ok) {
        const data = await res.json();
        setPolicy({
          ...data,
          themePolicy: { ...DEFAULT_THEME_POLICY, ...(data.themePolicy || {}) },
        });
      }
    } catch { /* ignore */ }
  }

  function toggleThemesEnabled() {
    setPolicy(prev => ({
      ...prev,
      features: { ...prev.features, themesEnabled: !prev.features.themesEnabled },
    }));
    setPolicyDirty(true);
    setMessage(null);
  }

  function toggleUserThemeUploads() {
    setPolicy(prev => ({
      ...prev,
      features: { ...prev.features, userThemesEnabled: !prev.features.userThemesEnabled },
    }));
    setPolicyDirty(true);
    setMessage(null);
  }

  function toggleBuiltinTheme(themeId: string) {
    setPolicy(prev => {
      const disabled = prev.themePolicy?.disabledBuiltinThemes || [];
      const isDisabled = disabled.includes(themeId);
      return {
        ...prev,
        themePolicy: {
          ...DEFAULT_THEME_POLICY,
          ...prev.themePolicy,
          disabledBuiltinThemes: isDisabled
            ? disabled.filter((id: string) => id !== themeId)
            : [...disabled, themeId],
        },
      };
    });
    setPolicyDirty(true);
    setMessage(null);
  }

  function toggleAdminTheme(themeId: string) {
    setPolicy(prev => {
      const disabled = prev.themePolicy?.disabledThemes || [];
      const isDisabled = disabled.includes(themeId);
      return {
        ...prev,
        themePolicy: {
          ...DEFAULT_THEME_POLICY,
          ...prev.themePolicy,
          disabledThemes: isDisabled
            ? disabled.filter((id: string) => id !== themeId)
            : [...disabled, themeId],
        },
      };
    });
    setPolicyDirty(true);
    setMessage(null);
  }

  function setDefaultTheme(themeId: string | null) {
    setPolicy(prev => ({
      ...prev,
      themePolicy: {
        ...DEFAULT_THEME_POLICY,
        ...prev.themePolicy,
        defaultThemeId: themeId,
      },
    }));
    setPolicyDirty(true);
    setMessage(null);
  }

  async function handleSavePolicy() {
    setSavingPolicy(true);
    setMessage(null);
    try {
      const res = await apiFetch('/api/admin/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Polityka motywów zapisana. Użytkownicy zobaczą zmiany przy następnym logowaniu.' });
        setPolicyDirty(false);
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Nie udało się zapisać polityki' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Nie udało się zapisać polityki' });
    } finally {
      setSavingPolicy(false);
    }
  }

  async function fetchThemes() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/themes');
      if (res.ok) setThemes(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/admin/themes', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        const warnings = data.warnings?.length ? ` (${data.warnings.length} ostrzeżenie(ń))` : '';
        setMessage({ type: 'success', text: `Motyw "${data.theme.name}" zainstalowany${warnings}` });
        await fetchThemes();
      } else {
        setMessage({ type: 'error', text: data.error || 'Przesyłanie nie powiodło się' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Przesyłanie nie powiodło się' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function toggleTheme(id: string, enabled: boolean) {
    setMessage(null);
    const res = await apiFetch('/api/admin/themes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    });

    if (res.ok) {
      setThemes(prev => prev.map(t => t.id === id ? { ...t, enabled } : t));
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: data.error || 'Aktualizacja nie powiodła się' });
    }
  }

  async function toggleForceEnabled(id: string, forceEnabled: boolean) {
    setMessage(null);
    const body: Record<string, unknown> = { id, forceEnabled };
    if (forceEnabled) body.enabled = true;

    const res = await apiFetch('/api/admin/themes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setThemes(prev => prev.map(t => t.id === id ? { ...t, forceEnabled, ...(forceEnabled ? { enabled: true } : {}) } : t));
      setPolicy(prev => {
        const current = prev.forceEnabledThemes || [];
        return {
          ...prev,
          forceEnabledThemes: forceEnabled
            ? [...current.filter(tid => tid !== id), id]
            : current.filter(tid => tid !== id),
        };
      });
      setPolicyDirty(true);
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: data.error || 'Aktualizacja nie powiodła się' });
    }
  }

  async function forceEnableAll() {
    setMessage(null);
    const disabled = themes.filter(t => !t.enabled);
    if (disabled.length === 0) {
      setMessage({ type: 'success', text: 'Wszystkie motywy są już włączone' });
      return;
    }
    let failed = 0;
    for (const t of disabled) {
      const res = await apiFetch('/api/admin/themes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, enabled: true }),
      });
      if (!res.ok) failed++;
    }
    if (failed === 0) {
      await fetchThemes();
      setMessage({ type: 'success', text: `Wszystkie ${disabled.length} motywów włączonych` });
    } else {
      await fetchThemes();
      setMessage({ type: 'error', text: `${failed} motywów nie udało się włączyć` });
    }
  }

  async function forceDisableAll() {
    setMessage(null);
    const enabled = themes.filter(t => t.enabled);
    if (enabled.length === 0) {
      setMessage({ type: 'success', text: 'Wszystkie motywy są już wyłączone' });
      return;
    }
    let failed = 0;
    for (const t of enabled) {
      const res = await apiFetch('/api/admin/themes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, enabled: false }),
      });
      if (!res.ok) failed++;
    }
    if (failed === 0) {
      await fetchThemes();
      setMessage({ type: 'success', text: `Wszystkie ${enabled.length} motywów wyłączonych` });
    } else {
      await fetchThemes();
      setMessage({ type: 'error', text: `${failed} motywów nie udało się wyłączyć` });
    }
  }

  async function deleteTheme(id: string, name: string) {
    if (!confirm(`Usunąć motyw "${name}"? Tej operacji nie można cofnąć.`)) return;

    setMessage(null);
    const res = await apiFetch('/api/admin/themes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      setThemes(prev => prev.filter(t => t.id !== id));
      setMessage({ type: 'success', text: `Motyw "${name}" usunięty` });
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: data.error || 'Usuwanie nie powiodło się' });
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Ładowanie...</div>;
  }

  const themesEnabled = policy.features.themesEnabled ?? true;
  const userThemesEnabled = policy.features.userThemesEnabled ?? true;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Motywy</h1>
          <p className="text-sm text-muted-foreground mt-1">Zarządzaj motywami i polityką motywów dla wszystkich użytkowników</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {policyDirty && (
            <button
              onClick={handleSavePolicy}
              disabled={savingPolicy}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
            >
              {savingPolicy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Zapisz politykę
            </button>
          )}
          <label className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer transition-all shadow-sm">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Prześlij motyw
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleUpload}
              disabled={uploading}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {message && (
        <div className={`text-sm rounded-md px-3 py-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Polityka motywów</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Kontroluj dostępność motywów i domyślne ustawienia dla użytkowników</p>
        </div>

        <div className="divide-y divide-border">
          <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <span className="text-sm text-foreground">Motywy włączone</span>
              <p className="text-xs text-muted-foreground mt-0.5">Zezwalaj użytkownikom na wybieranie i stosowanie motywów</p>
            </div>
            <button onClick={toggleThemesEnabled}
              className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${themesEnabled ? 'bg-primary' : 'bg-muted-foreground/25 dark:bg-muted-foreground/50'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${themesEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <span className="text-sm text-foreground">Przesyłanie motywów przez użytkowników</span>
              <p className="text-xs text-muted-foreground mt-0.5">Zezwalaj użytkownikom na przesyłanie własnych plików motywów</p>
            </div>
            <button onClick={toggleUserThemeUploads}
              className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${userThemesEnabled ? 'bg-primary' : 'bg-muted-foreground/25 dark:bg-muted-foreground/50'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${userThemesEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
            </button>
          </div>

          {themes.length > 0 && (
            <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <span className="text-sm text-foreground">Wymuś włączenie/wyłączenie wszystkich</span>
                <p className="text-xs text-muted-foreground mt-0.5">Zbiorcze przełączanie wszystkich wdrożonych motywów</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={forceEnableAll}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
                >
                  <Power className="w-3.5 h-3.5" />
                  Włącz wszystkie
                </button>
                <button
                  onClick={forceDisableAll}
                  className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-muted text-muted-foreground text-xs font-medium hover:bg-accent hover:text-foreground transition-colors"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                  Wyłącz wszystkie
                </button>
              </div>
            </div>
          )}

          <div className="px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <span className="text-sm text-foreground">Domyślny motyw</span>
                <p className="text-xs text-muted-foreground mt-0.5">Motyw stosowany, gdy użytkownicy nie wybrali żadnego</p>
              </div>
              <select
                value={policy.themePolicy?.defaultThemeId || ''}
                onChange={(e) => setDefaultTheme(e.target.value || null)}
                className="h-8 px-2 w-full sm:w-auto shrink-0 rounded-md border border-input bg-background text-sm text-foreground"
              >
                <option value="">Domyślny systemowy</option>
                <optgroup label="Wbudowane">
                  {BUILTIN_THEME_OPTIONS
                    .filter(t => !(policy.themePolicy?.disabledBuiltinThemes || []).includes(t.id))
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </optgroup>
                {themes.length > 0 && (
                  <optgroup label="Wdrożone przez administratora">
                    {themes
                      .filter(t => !(policy.themePolicy?.disabledThemes || []).includes(t.id))
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          <div className="px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Wbudowane motywy</span>
            <div className="mt-2 space-y-2">
              {BUILTIN_THEME_OPTIONS.map(theme => {
                const disabled = (policy.themePolicy?.disabledBuiltinThemes || []).includes(theme.id);
                return (
                  <div key={theme.id} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-foreground">{theme.name}</span>
                    <button onClick={() => toggleBuiltinTheme(theme.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${!disabled ? 'bg-primary' : 'bg-muted-foreground/25 dark:bg-muted-foreground/50'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${!disabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {themes.length > 0 && (
            <div className="px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Motywy wdrożone przez administratora</span>
              <div className="mt-2 space-y-2">
                {themes.map(theme => {
                  const disabled = (policy.themePolicy?.disabledThemes || []).includes(theme.id);
                  return (
                    <div key={theme.id} className="flex items-center justify-between gap-4">
                      <span className="text-sm text-foreground">{theme.name}</span>
                      <button onClick={() => toggleAdminTheme(theme.id)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${!disabled ? 'bg-primary' : 'bg-muted-foreground/25 dark:bg-muted-foreground/50'}`}>
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${!disabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground">Wdrożone motywy</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Motywy przesłane przez administratora dostępne dla wszystkich użytkowników</p>
        </div>
        {themes.length === 0 ? (
          <div className="p-12 text-center">
            <Palette className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Brak zainstalowanych motywów</p>
            <p className="text-xs text-muted-foreground mt-1">Prześlij plik ZIP motywu, aby rozpocząć</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {themes.map(theme => (
              <div key={theme.id} className="px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-foreground">{theme.name}</span>
                    <span className="text-xs text-muted-foreground">v{theme.version}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${theme.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                      {theme.enabled ? 'Włączone' : 'Wyłączone'}
                    </span>
                    {theme.forceEnabled && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Wymuszone
                      </span>
                    )}
                  </div>
                  {theme.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{theme.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    autor: {theme.author} &middot; {theme.variants.join(', ')} &middot; zainstalowano {new Date(theme.installedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleForceEnabled(theme.id, !theme.forceEnabled)}
                    title={theme.forceEnabled ? 'Usuń wymuszone włączenie (użytkownicy mogą dezaktywować)' : 'Wymuś włączenie (użytkownicy nie mogą dezaktywować)'}
                    className={`p-2 rounded-md transition-colors ${theme.forceEnabled ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50' : 'hover:bg-accent text-muted-foreground hover:text-foreground'}`}
                  >
                    {theme.forceEnabled ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => toggleTheme(theme.id, !theme.enabled)}
                    title={theme.enabled ? 'Wyłącz' : 'Włącz'}
                    className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTheme(theme.id, theme.name)}
                    title="Usuń"
                    className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
