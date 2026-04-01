import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { whitelistSetting } from '../../utils/storage';

const DEBOUNCE_MS = 500;

export function App() {
  const [value, setValue] = useState('');
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    whitelistSetting.getValue().then((whitelist) => {
      setValue(whitelist.map((p) => p.replaceAll('[^ ]*', '*')).join('\n'));
    });
  }, []);

  const handleInput = useCallback((e: Event) => {
    const raw = (e.currentTarget as HTMLTextAreaElement).value;
    const normalized = raw
      .split('\n')
      .map((line) => line.trim())
      .join('\n');
    setValue(normalized);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = globalThis.setTimeout(() => {
      const trimmed = normalized.trim();
      const whitelist = trimmed
        .split('\n')
        .filter(Boolean)
        .map((pattern) => pattern.replaceAll('*', '[^ ]*'));
      whitelistSetting.setValue(whitelist);
    }, DEBOUNCE_MS) as unknown as number;
  }, []);

  return (
    <main>
      <label for="whitelist">Whitelist</label>
      <p>Specify the URL patterns of sites that you want to be excluded from converting in auto mode.</p>
      <textarea
        id="whitelist"
        placeholder="https://*.example.com/*"
        spellcheck={false}
        value={value}
        onInput={handleInput}
      />
    </main>
  );
}
