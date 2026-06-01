'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, Lock } from 'lucide-react';
import type { SettingsPolicy, FeatureGates } from '@/lib/admin/types';
import { DEFAULT_FEATURE_GATES, DEFAULT_POLICY } from '@/lib/admin/types';
import { apiFetch } from '@/lib/browser-navigation';

const EXCLUDED_FEATURE_GATES: (keyof FeatureGates)[] = ['pluginsEnabled', 'pluginsUploadEnabled', 'themesEnabled', 'userThemesEnabled'];

const FEATURE_GATE_LABELS: Partial<Record<keyof FeatureGates, { label: string; description: string }>> = {
  sidebarAppsEnabled: { label: 'Aplikacje panelu bocznego', description: 'Zezwalaj na niestandardowe aplikacje webowe w panelu nawigacyjnym' },
  settingsExportEnabled: { label: 'Eksport/import ustawień', description: 'Zezwalaj użytkownikom na eksport i import ustawień JSON' },
  customKeywordsEnabled: { label: 'Niestandardowe słowa kluczowe', description: 'Zezwalaj na etykiety i tagi tworzone przez użytkowników' },
  templatesEnabled: { label: 'Szablony e-mail', description: 'Zezwalaj na tworzenie szablonów e-mail i bibliotekę' },
  calendarTasksEnabled: { label: 'Zadania kalendarza', description: 'Pokaż panel zadań w widoku kalendarza' },
  contactsEnabled: { label: 'Kontakty', description: 'Włącz funkcje kontaktów/książki adresowej' },
  smimeEnabled: { label: 'S/MIME', description: 'Włącz zarządzanie certyfikatami i podpisywanie e-maili' },
  externalContentEnabled: { label: 'Treści zewnętrzne', description: 'Zezwalaj użytkownikom na wybór polityki ładowania treści zewnętrznych' },
  debugModeEnabled: { label: 'Tryb debugowania', description: 'Zezwalaj użytkownikom na włączanie trybu debugowania/diagnostycznego' },
  folderIconsEnabled: { label: 'Ikony folderów', description: 'Zezwalaj na niestandardowy wybór ikon folderów' },
  hoverActionsConfigEnabled: { label: 'Konfiguracja akcji po najechaniu', description: 'Zezwalaj użytkownikom na dostosowywanie akcji po najechaniu na e-mail' },
  filesEnabled: { label: 'Pliki (WebDAV)', description: 'Włącz przechowywanie plików przez WebDAV. UWAGA: Duże przesyłania mogą powodować niestabilność Stalwart/RocksDB. Niezalecane dla produkcji.' },
};

const RESTRICTABLE_SETTINGS = [
  { key: 'fontSize', label: 'Rozmiar czcionki', category: 'Wygląd', type: 'enum', allowedValues: ['small', 'medium', 'large'] },
  { key: 'density', label: 'Gęstość', category: 'Wygląd', type: 'enum', allowedValues: ['compact', 'regular', 'spacious'] },
  { key: 'animationsEnabled', label: 'Animacje', category: 'Wygląd', type: 'boolean' },
  { key: 'markAsReadDelay', label: 'Opóźnienie oznaczenia jako przeczytane', category: 'E-mail', type: 'number' },
  { key: 'deleteAction', label: 'Akcja usuwania', category: 'E-mail', type: 'enum', allowedValues: ['trash', 'trash-and-read', 'permanent'] },
  { key: 'showPreview', label: 'Pokaż podgląd', category: 'E-mail', type: 'boolean' },
  { key: 'mailLayout', label: 'Układ poczty', category: 'E-mail', type: 'enum', allowedValues: ['split', 'focus', 'horizontal'] },
  { key: 'emailsPerPage', label: 'E-maili na stronę', category: 'E-mail', type: 'number' },
  { key: 'externalContentPolicy', label: 'Polityka treści zewnętrznych', category: 'E-mail', type: 'enum', allowedValues: ['allow', 'block', 'ask'] },
  { key: 'sendConfirmation', label: 'Potwierdzenie wysyłania', category: 'Edytor', type: 'boolean' },
  { key: 'defaultReplyMode', label: 'Domyślny tryb odpowiedzi', category: 'Edytor', type: 'enum', allowedValues: ['reply', 'reply-all'] },
  { key: 'autoSelectReplyIdentity', label: 'Automatyczny wybór tożsamości odpowiedzi', category: 'Edytor', type: 'boolean' },
  { key: 'plainTextMode', label: 'Tylko zwykły tekst', category: 'Edytor', type: 'boolean' },
  { key: 'sessionTimeout', label: 'Limit czasu sesji', category: 'Prywatność', type: 'number' },
  { key: 'emailNotificationsEnabled', label: 'Powiadomienia e-mail', category: 'Powiadomienia', type: 'boolean' },
  { key: 'calendarNotificationsEnabled', label: 'Powiadomienia kalendarza', category: 'Powiadomienia', type: 'boolean' },
  { key: 'debugMode', label: 'Tryb debugowania', category: 'Zaawansowane', type: 'boolean' },
];

export function PolicyTab() {
  const [policy, setPolicy] = useState<SettingsPolicy>({ ...DEFAULT_POLICY });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { fetchPolicy(); }, []);

  async function fetchPolicy() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/policy');
      if (res.ok) {
        const data = await res.json();
        setPolicy(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleFeature(key: keyof FeatureGates) {
    setPolicy(prev => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }));
    setDirty(true);
    setMessage(null);
  }

  function setPushRelayUrl(value: string) {
    setPolicy(prev => ({ ...prev, pushRelayUrl: value }));
    setDirty(true);
    setMessage(null);
  }

  function togglePushRelayLocked() {
    setPolicy(prev => ({ ...prev, pushRelayUrlLocked: !prev.pushRelayUrlLocked }));
    setDirty(true);
    setMessage(null);
  }

  function toggleLocked(settingKey: string) {
    setPolicy(prev => {
      const existing = prev.restrictions[settingKey] || {};
      const newRestrictions = { ...prev.restrictions };
      if (existing.locked) {
        delete newRestrictions[settingKey];
      } else {
        newRestrictions[settingKey] = { ...existing, locked: true };
      }
      return { ...prev, restrictions: newRestrictions };
    });
    setDirty(true);
    setMessage(null);
  }

  function toggleHidden(settingKey: string) {
    setPolicy(prev => {
      const existing = prev.restrictions[settingKey] || {};
      const newRestrictions = { ...prev.restrictions };
      newRestrictions[settingKey] = { ...existing, hidden: !existing.hidden };
      if (!newRestrictions[settingKey].hidden && !newRestrictions[settingKey].locked) {
        delete newRestrictions[settingKey];
      }
      return { ...prev, restrictions: newRestrictions };
    });
    setDirty(true);
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    const res = await apiFetch('/api/admin/policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });

    if (res.ok) {
      setMessage({ type: 'success', text: 'Polityka zapisana. Użytkownicy zobaczą zmiany przy następnym logowaniu.' });
      setDirty(false);
    } else {
      const data = await res.json();
      setMessage({ type: 'error', text: data.error || 'Nie udało się zapisać' });
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Ładowanie...</div>;
  }

  const categories = [...new Set(RESTRICTABLE_SETTINGS.map(s => s.category))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Polityka użytkownika</h1>
          <p className="text-sm text-muted-foreground mt-1">Kontroluj, do których funkcji i ustawień użytkownicy mają dostęp</p>
        </div>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Zapisz politykę
          </button>
        )}
      </div>

      {message && (
        <div className={`text-sm rounded-md px-3 py-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-medium text-foreground">Bramki funkcji</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Włączaj lub wyłączaj całe funkcje dla wszystkich użytkowników. Bramki wtyczek i motywów znajdują się na odpowiednich stronach administracyjnych.</p>
        </div>
        <div className="divide-y divide-border">
          {(Object.keys(DEFAULT_FEATURE_GATES) as (keyof FeatureGates)[])
            .filter(key => !EXCLUDED_FEATURE_GATES.includes(key))
            .map(key => {
            const meta = FEATURE_GATE_LABELS[key];
            if (!meta) return null;
            const { label, description } = meta;
            const enabled = policy.features[key];
            return (
              <div key={key} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <span className="text-sm text-foreground">{label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                <button onClick={() => toggleFeature(key)}
                  className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted-foreground/25 dark:bg-muted-foreground/50'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <h2 className="text-sm font-medium text-foreground">Przekaźnik Push</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Nadpisz URL przekaźnika Web Push wyświetlany w ustawieniach powiadomień użytkownika. Pozostaw puste, aby użyć wbudowanego domyślnego.</p>
        </div>
        <div className="px-4 py-3 space-y-3">
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={policy.pushRelayUrl ?? ''}
            onChange={(e) => setPushRelayUrl(e.target.value)}
            placeholder="https://notifications.relay.example.com"
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={!!policy.pushRelayUrlLocked}
              onChange={togglePushRelayLocked}
              className="rounded border-input"
            />
            <Lock className="w-3 h-3" /> Blokada - użytkownicy nie mogą zmienić tego URL
          </label>
        </div>
      </div>

      {categories.map(category => (
        <div key={category} className="border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h2 className="text-sm font-medium text-foreground">{category}</h2>
          </div>
          <div className="divide-y divide-border">
            {RESTRICTABLE_SETTINGS.filter(s => s.category === category).map(setting => {
              const restriction = policy.restrictions[setting.key] || {};
              return (
                <div key={setting.key} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-sm text-foreground">{setting.label}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={!!restriction.locked} onChange={() => toggleLocked(setting.key)}
                        className="rounded border-input" />
                      <Lock className="w-3 h-3" /> Blokada
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={!!restriction.hidden} onChange={() => toggleHidden(setting.key)}
                        className="rounded border-input" />
                      Ukryj
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
