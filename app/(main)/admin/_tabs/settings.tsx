'use client';

import { useEffect, useState } from 'react';
import { Save, RotateCcw, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/browser-navigation';
import { JmapServersSection } from './_jmap-servers-section';
import type { JmapServerEntry } from '@/lib/admin/jmap-servers';

interface ConfigEntry {
  value?: unknown;
  source: 'admin' | 'env' | 'default';
  hasValue?: boolean;
}

export function SettingsTab() {
  const [config, setConfig] = useState<Record<string, ConfigEntry>>({});
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    const res = await apiFetch('/api/admin/config');
    if (res.ok) {
      setConfig(await res.json());
    }
    setLoading(false);
  }

  function handleChange(key: string, value: unknown) {
    setEdits(prev => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  function currentValue(key: string): unknown {
    if (key in edits) return edits[key];
    return config[key]?.value;
  }

  async function handleSave() {
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    setMessage(null);

    const res = await apiFetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edits),
    });

    if (res.ok) {
      setMessage({ type: 'success', text: 'Ustawienia zapisane. Zmiany zaczną obowiązywać przy następnym załadowaniu strony.' });
      setEdits({});
      await fetchConfig();
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: data.error || 'Nie udało się zapisać' });
    }
    setSaving(false);
  }

  async function handleRevert(key: string) {
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
      setMessage({ type: 'success', text: `${key} przywrócono do domyślnych` });
    }
  }

  const hasEdits = Object.keys(edits).length > 0;

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Ładowanie...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Ustawienia serwera</h1>
          <p className="text-sm text-muted-foreground mt-1">Ogólna konfiguracja serwera</p>
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

      {message && (
        <div className={`text-sm rounded-md px-3 py-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <SettingsSection title="Ogólne">
        <TextSetting label="Nazwa aplikacji" configKey="appName" value={currentValue('appName') as string} source={config.appName?.source} onChange={handleChange} onRevert={handleRevert} />
        <TextSetting label="URL serwera JMAP" configKey="jmapServerUrl" value={currentValue('jmapServerUrl') as string} source={config.jmapServerUrl?.source} onChange={handleChange} onRevert={handleRevert} placeholder="https://mail.example.com" />
        <ToggleSetting label="Zezwalaj na niestandardowy punkt końcowy JMAP" description="Pokaż pole URL serwera JMAP w formularzu logowania, umożliwiając użytkownikom połączenie z dowolnym serwerem JMAP" configKey="allowCustomJmapEndpoint" value={currentValue('allowCustomJmapEndpoint') as boolean} source={config.allowCustomJmapEndpoint?.source} onChange={handleChange} onRevert={handleRevert} />
        {!!currentValue('allowCustomJmapEndpoint') && (
          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 dark:border-amber-600">
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Ostrzeżenie CORS:</strong> Zewnętrzne serwery JMAP muszą zawierać tę domenę w nagłówku CORS <code className="text-[11px] bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">Access-Control-Allow-Origin</code> lub żądania z przeglądarki będą blokowane.
            </p>
          </div>
        )}
        <ToggleSetting label="Funkcje Stalwart" description="Włącz funkcje specyficzne dla serwera poczty Stalwart" configKey="stalwartFeaturesEnabled" value={currentValue('stalwartFeaturesEnabled') as boolean} source={config.stalwartFeaturesEnabled?.source} onChange={handleChange} onRevert={handleRevert} />
        <ToggleSetting label="Tryb demonstracyjny" description="Włącz tryb demonstracyjny z przykładowymi danymi" configKey="demoMode" value={currentValue('demoMode') as boolean} source={config.demoMode?.source} onChange={handleChange} onRevert={handleRevert} />
        <ToggleSetting label="Indeksowanie przez wyszukiwarki" description="Zezwalaj wyszukiwarkom na indeksowanie tego webmaila. Wyłączone (domyślnie) wysyła noindex/nofollow w nagłówku strony, zalecane dla prywatnych wdrożeń." configKey="searchEngineIndexing" value={currentValue('searchEngineIndexing') as boolean} source={config.searchEngineIndexing?.source} onChange={handleChange} onRevert={handleRevert} />
      </SettingsSection>

      <SettingsSection title="Serwery JMAP (wiele serwerów)">
        <ToggleSetting
          label="Automatyczny wybór serwera według domeny e-mail"
          description="Gdy użytkownicy wpisują swój e-mail, automatycznie wybierz pasujący serwer z poniższej listy."
          configKey="jmapServerAutoPickByDomain"
          value={currentValue('jmapServerAutoPickByDomain') as boolean}
          source={config.jmapServerAutoPickByDomain?.source}
          onChange={handleChange}
          onRevert={handleRevert}
        />
        <JmapServersSection
          value={(currentValue('jmapServers') as JmapServerEntry[]) ?? []}
          source={config.jmapServers?.source}
          onChange={(next) => handleChange('jmapServers', next)}
          onRevert={() => handleRevert('jmapServers')}
        />
        {Array.isArray(currentValue('jmapServers')) && (currentValue('jmapServers') as JmapServerEntry[]).length > 0 && (
          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-400 dark:border-amber-600">
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Ostrzeżenie CORS:</strong> Każdy serwer JMAP musi zezwalać na źródło tego webmaila w nagłówku <code className="text-[11px] bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">Access-Control-Allow-Origin</code> lub żądania przeglądarki będą blokowane.
            </p>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Logowanie">
        <SelectSetting label="Format dziennika" configKey="logFormat" value={currentValue('logFormat') as string} source={config.logFormat?.source} options={['text', 'json']} onChange={handleChange} onRevert={handleRevert} />
        <SelectSetting label="Poziom dziennika" configKey="logLevel" value={currentValue('logLevel') as string} source={config.logLevel?.source} options={['error', 'warn', 'info', 'debug']} onChange={handleChange} onRevert={handleRevert} />
      </SettingsSection>

      <SettingsSection title="Synchronizacja ustawień">
        <ToggleSetting label="Synchronizacja ustawień włączona" description="Wymaga ustawienia SESSION_SECRET" configKey="settingsSyncEnabled" value={currentValue('settingsSyncEnabled') as boolean} source={config.settingsSyncEnabled?.source} onChange={handleChange} onRevert={handleRevert} />
      </SettingsSection>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (!source || source === 'default') return null;
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${source === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
      {source}
    </span>
  );
}

function TextSetting({ label, configKey, value, source, onChange, onRevert, placeholder }: {
  label: string; configKey: string; value: string; source?: string;
  onChange: (key: string, value: unknown) => void; onRevert: (key: string) => void; placeholder?: string;
}) {
  return (
    <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <label className="text-sm text-foreground">{label}</label>
        <SourceBadge source={source} />
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(configKey, e.target.value)}
          placeholder={placeholder}
          className="h-8 w-full sm:w-64 rounded-md border border-input bg-background px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {source === 'admin' && (
          <button onClick={() => onRevert(configKey)} className="shrink-0 text-muted-foreground hover:text-foreground" title="Przywróć domyślne">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleSetting({ label, description, configKey, value, source, onChange, onRevert }: {
  label: string; description?: string; configKey: string; value: boolean; source?: string;
  onChange: (key: string, value: unknown) => void; onRevert: (key: string) => void;
}) {
  return (
    <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">{label}</span>
          <SourceBadge source={source} />
        </div>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onChange(configKey, !value)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-primary' : 'bg-muted-foreground/25 dark:bg-muted-foreground/50'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${value ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
        </button>
        {source === 'admin' && (
          <button onClick={() => onRevert(configKey)} className="text-muted-foreground hover:text-foreground" title="Przywróć domyślne">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function SelectSetting({ label, configKey, value, source, options, onChange, onRevert }: {
  label: string; configKey: string; value: string; source?: string; options: string[];
  onChange: (key: string, value: unknown) => void; onRevert: (key: string) => void;
}) {
  return (
    <div className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-foreground">{label}</span>
        <SourceBadge source={source} />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(configKey, e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        {source === 'admin' && (
          <button onClick={() => onRevert(configKey)} className="text-muted-foreground hover:text-foreground" title="Przywróć domyślne">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
