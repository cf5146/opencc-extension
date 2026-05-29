<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from 'wxt/browser';

  import type {
    ConvertPageResponse,
    PageStatusResponse,
    RuntimeMessageResponse,
  } from '@/lib/messaging';
  import { defaultSettings, settingsItem, type ExtensionSettings } from '@/lib/storage';

  import AutoModeToggle from './components/AutoModeToggle.svelte';
  import ConvertButton from './components/ConvertButton.svelte';
  import SiteIndicator from './components/SiteIndicator.svelte';
  import TextBox from './components/TextBox.svelte';
  import VariantSelector from './components/VariantSelector.svelte';

  let settings: ExtensionSettings = { ...defaultSettings };
  let isConverted = false;
  let activeTab: 'convert' | 'textbox' = 'convert';
  let statusMessage = '';
  let busy = false;
  let hostname = '';

  function i18n(key: string, fallback: string): string {
    return browser.i18n.getMessage(key) || fallback;
  }

  function applyTheme(theme: ExtensionSettings['theme']): void {
    document.documentElement.dataset.theme = theme;
  }

  async function sendRuntimeMessage<T>(message: unknown): Promise<RuntimeMessageResponse<T>> {
    const response: unknown = await browser.runtime.sendMessage(message);
    return response as RuntimeMessageResponse<T>;
  }

  async function refreshPageStatus(): Promise<void> {
    const response = await sendRuntimeMessage<PageStatusResponse>({
      type: 'GET_ACTIVE_TAB_STATUS',
    });
    isConverted = response.ok ? (response.data?.isConverted ?? false) : false;
  }

  async function refreshActiveHost(): Promise<void> {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    hostname = tab.url ? new URL(tab.url).hostname : '';
  }

  async function persistSettings(): Promise<void> {
    await settingsItem.setValue(settings);
    applyTheme(settings.theme);
  }

  async function handleConvert(): Promise<void> {
    busy = true;
    statusMessage = '';
    const response = await sendRuntimeMessage<ConvertPageResponse>({
      type: 'CONVERT_ACTIVE_TAB',
      origin: settings.origin,
      target: settings.target,
      autoMode: settings.autoMode,
    });
    busy = false;

    if (!response.ok) {
      statusMessage = response.error ?? 'Unable to convert this page.';
      isConverted = false;
      return;
    }

    isConverted = response.data?.isConverted ?? false;
    statusMessage = response.data
      ? `${String(response.data.count)} nodes changed in ${String(response.data.time)}ms`
      : '';
  }

  async function handleRestore(): Promise<void> {
    busy = true;
    statusMessage = '';
    const response = await sendRuntimeMessage<PageStatusResponse>({ type: 'RESTORE_ACTIVE_TAB' });
    busy = false;

    if (!response.ok) {
      statusMessage = response.error ?? 'Unable to restore this page.';
      return;
    }

    isConverted = response.data?.isConverted ?? false;
  }

  async function handleSettingsChange(): Promise<void> {
    await persistSettings();
  }

  async function handleSwap(): Promise<void> {
    settings = {
      ...settings,
      origin: settings.target,
      target: settings.origin,
    };
    await handleSettingsChange();
  }

  async function handleThemeToggle(): Promise<void> {
    settings = {
      ...settings,
      theme: settings.theme === 'dark' ? 'light' : 'dark',
    };
    await handleSettingsChange();
  }

  async function handleAutoModeChange(): Promise<void> {
    await handleSettingsChange();
    if (settings.autoMode) {
      await handleConvert();
    } else {
      await handleRestore();
    }
  }

  onMount(async () => {
    settings = await settingsItem.getValue();
    applyTheme(settings.theme);
    await Promise.all([refreshPageStatus(), refreshActiveHost()]);
  });
</script>

<main class="popup-shell">
  <header class="popup-header">
    <div>
      <h1>OpenCC</h1>
      <p>{i18n('extDescription', 'Convert webpages between Chinese variants.')}</p>
    </div>
    <button
      class="icon-button"
      type="button"
      data-testid="theme-toggle"
      aria-label="Toggle dark mode"
      on:click={handleThemeToggle}
    >
      {settings.theme === 'dark' ? '☀' : '☾'}
    </button>
  </header>

  <nav class="tab-bar" aria-label="Popup sections">
    <button
      class:active={activeTab === 'convert'}
      type="button"
      on:click={() => (activeTab = 'convert')}
    >
      {i18n('popupConvert', 'Convert Page')}
    </button>
    <button
      class:active={activeTab === 'textbox'}
      type="button"
      on:click={() => (activeTab = 'textbox')}
    >
      {i18n('popupTextBox', 'Text Box')}
    </button>
  </nav>

  {#if activeTab === 'convert'}
    <section class="panel" aria-label="Page conversion">
      <SiteIndicator {hostname} {settings} />
      <VariantSelector
        bind:origin={settings.origin}
        bind:target={settings.target}
        onChange={handleSettingsChange}
        onSwap={handleSwap}
      />
      <ConvertButton {busy} {isConverted} onConvert={handleConvert} onRestore={handleRestore} />
      <AutoModeToggle bind:enabled={settings.autoMode} onChange={handleAutoModeChange} />
    </section>
  {:else}
    <section class="panel" aria-label="Text conversion">
      <TextBox origin={settings.origin} target={settings.target} />
    </section>
  {/if}

  {#if statusMessage}
    <p class:error={statusMessage.includes('Unable')} class="status">{statusMessage}</p>
  {/if}

  <footer class="popup-footer">
    <span>{i18n('shortcutHint', 'Keyboard shortcut: Alt+Shift+C')}</span>
    <button type="button" on:click={() => browser.runtime.openOptionsPage()}>Options</button>
  </footer>
</main>
