<script lang="ts">
  import { onMount } from 'svelte';

  import {
    defaultSettings,
    domainListItem,
    settingsItem,
    sitePreferencesItem,
    type DomainList,
    type ExtensionSettings,
    type SitePreference,
  } from '@/lib/storage';

  import BlocklistEditor from './components/BlocklistEditor.svelte';
  import PreferenceTable from './components/PreferenceTable.svelte';
  import ShortcutDisplay from './components/ShortcutDisplay.svelte';

  let settings: ExtensionSettings = { ...defaultSettings };
  let domainList: DomainList = { blocklist: [], allowlist: [] };
  let preferences: Record<string, SitePreference> = {};
  let importExportText = '';
  let notice = '';

  function applyTheme(theme: ExtensionSettings['theme']): void {
    document.documentElement.dataset.theme = theme;
  }

  async function saveDomainList(next: DomainList): Promise<void> {
    domainList = next;
    await domainListItem.setValue(domainList);
  }

  async function updateTheme(theme: ExtensionSettings['theme']): Promise<void> {
    settings = { ...settings, theme };
    await settingsItem.setValue(settings);
    applyTheme(theme);
  }

  async function removePreference(hostname: string): Promise<void> {
    const next: Record<string, SitePreference> = Object.fromEntries(
      Object.entries(preferences).filter(([key]) => key !== hostname),
    );
    preferences = next;
    await sitePreferencesItem.setValue(next);
  }

  function exportDomainList(): void {
    importExportText = JSON.stringify(domainList, null, 2);
    notice = 'Domain rules exported.';
  }

  async function importDomainList(): Promise<void> {
    const parsed = JSON.parse(importExportText) as DomainList;
    if (!Array.isArray(parsed.blocklist) || !Array.isArray(parsed.allowlist)) {
      throw new Error('Import must include blocklist and allowlist arrays.');
    }

    await saveDomainList({
      blocklist: parsed.blocklist.map(String),
      allowlist: parsed.allowlist.map(String),
    });
    notice = 'Domain rules imported.';
  }

  async function saveBlocklist(blocklist: string[]): Promise<void> {
    await saveDomainList({ ...domainList, blocklist });
  }

  async function saveAllowlist(allowlist: string[]): Promise<void> {
    await saveDomainList({ ...domainList, allowlist });
  }

  onMount(async () => {
    [settings, domainList, preferences] = await Promise.all([
      settingsItem.getValue(),
      domainListItem.getValue(),
      sitePreferencesItem.getValue(),
    ]);
    applyTheme(settings.theme);
  });
</script>

<main class="options-shell">
  <header class="options-header">
    <div>
      <h1>OpenCC Options</h1>
      <p>Manage automatic conversion, per-site preferences, and keyboard shortcuts.</p>
    </div>
    <label>
      <span>Theme</span>
      <select bind:value={settings.theme} on:change={() => updateTheme(settings.theme)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  </header>

  <section class="card">
    <h2>Domain rules</h2>
    <div class="rule-grid">
      <BlocklistEditor
        label="Blocklist"
        description="Never auto-convert matching domains."
        patterns={domainList.blocklist}
        onUpdate={saveBlocklist}
      />
      <BlocklistEditor
        label="Allowlist"
        description="Allow matching domains even when a blocklist rule also matches."
        patterns={domainList.allowlist}
        onUpdate={saveAllowlist}
      />
    </div>
    <div class="import-export">
      <textarea bind:value={importExportText} placeholder="Exported JSON appears here"></textarea>
      <div>
        <button type="button" on:click={exportDomainList}>Export JSON</button>
        <button type="button" on:click={importDomainList}>Import JSON</button>
      </div>
    </div>
  </section>

  <section class="card">
    <h2>Per-site preferences</h2>
    <PreferenceTable {preferences} onRemove={removePreference} />
  </section>

  <section class="card">
    <h2>Keyboard shortcut</h2>
    <ShortcutDisplay />
  </section>

  {#if notice}
    <p class="notice">{notice}</p>
  {/if}
</main>
