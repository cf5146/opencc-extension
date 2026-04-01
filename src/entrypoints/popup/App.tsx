import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { useSettings } from '../../hooks/useSettings';
import { convertText } from '../../utils/conversion';
import type { LocaleCode } from '../../utils/storage';

const RETRY_DELAY_MS = 120;
const INPUT_DEBOUNCE_MS = 250;

interface PageConvertResponse {
  count: number;
  time: number;
}

function isErrorWithMessage(err: unknown): err is { message: string } {
  return typeof err === 'object' && err !== null && 'message' in err && typeof (err as { message: unknown }).message === 'string';
}

async function sendPageConvert(): Promise<PageConvertResponse | undefined> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  const tabId = tab?.id;
  const url = tab?.url;
  if (tabId == null) return undefined;
  if (!url || !/^https?:/i.test(url)) return undefined;

  const attempt = async (): Promise<PageConvertResponse> => browser.tabs.sendMessage(tabId, { action: 'click' });

  try {
    return await attempt();
  } catch (e: unknown) {
    if (isErrorWithMessage(e) && !/receiving end/i.test(e.message)) {
      console.debug('OpenCC popup: initial sendMessage failed, attempting recovery:', e.message);
    }
    try {
      await browser.runtime.sendMessage({ action: 'ensure-script' });
    } catch {
      /* ignore */
    }
    try {
      if (browser.scripting !== undefined && typeof browser.scripting.executeScript === 'function') {
        await browser.scripting.executeScript({
          target: { tabId },
          files: ['/content-scripts/content.js'],
        });
      }
    } catch {
      /* ignore injection errors */
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    try {
      return await attempt();
    } catch {
      return undefined;
    }
  }
}

const LOCALE_LABELS: Record<LocaleCode, string> = {
  cn: 'cn (简)',
  hk: 'hk (港)',
  tw: 'tw (臺)',
  twp: 'twp (臺灣常用詞彙)',
  jp: 'jp (日)',
};

export function App() {
  const { origin, target, auto, textboxSize, setOrigin, setTarget, setAuto, setTextboxSize } = useSettings();

  const [footerText, setFooterText] = useState('');
  const [footerError, setFooterError] = useState(false);
  const [converting, setConverting] = useState(false);
  const [textboxValue, setTextboxValue] = useState('');
  const textboxRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const [version, setVersion] = useState('');

  useEffect(() => {
    try {
      setVersion(browser.runtime.getManifest().version);
    } catch {
      // ignore
    }
  }, []);

  // Restore textbox size
  useEffect(() => {
    const el = textboxRef.current;
    if (!el) return;
    if (textboxSize.width) el.style.width = `${textboxSize.width}px`;
    if (textboxSize.height) el.style.height = `${textboxSize.height}px`;
  }, [textboxSize]);

  // ResizeObserver for textbox
  useEffect(() => {
    const el = textboxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setTextboxSize({ width: el.offsetWidth, height: el.offsetHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setTextboxSize]);

  const doTextboxConvert = useCallback(() => {
    if (origin === target) return;
    setTextboxValue((prev) => {
      if (!prev.trim()) return prev;
      try {
        const converted = convertText(prev, origin, target);
        return converted !== prev ? converted : prev;
      } catch {
        return prev;
      }
    });
  }, [origin, target]);

  const scheduleTextboxConvert = useCallback(() => {
    if (debounceRef.current) globalThis.clearTimeout(debounceRef.current);
    debounceRef.current = globalThis.setTimeout(doTextboxConvert, INPUT_DEBOUNCE_MS) as unknown as number;
  }, [doTextboxConvert]);

  const handleConvertPage = useCallback(async () => {
    setConverting(true);
    setFooterError(false);
    setFooterText('');
    const response = await sendPageConvert();
    setConverting(false);
    if (response && typeof response.count === 'number') {
      setFooterText(`${response.count} nodes changed in ${response.time}ms`);
      setFooterError(false);
    } else {
      setFooterText('NO ACCESS / PROTECTED PAGE');
      setFooterError(true);
    }
  }, []);

  const handleSwap = useCallback(() => {
    const o = origin;
    const t = target;
    setOrigin(t);
    setTarget(o);
    if (textboxValue) scheduleTextboxConvert();
  }, [origin, target, setOrigin, setTarget, textboxValue, scheduleTextboxConvert]);

  const handleAutoChange = useCallback(
    (e: Event) => {
      const checked = (e.currentTarget as HTMLInputElement).checked;
      setAuto(checked);
      browser.action.setBadgeText({ text: checked ? 'A' : '' });
      if (checked) {
        browser.runtime.sendMessage({ action: 'ensure-script' }).catch(() => {});
      }
    },
    [setAuto],
  );

  const handleReset = useCallback(() => {
    setTextboxValue('');
    const el = textboxRef.current;
    if (el) {
      el.style.width = '';
      el.style.height = '';
    }
  }, []);

  return (
    <>
      <header class="app-header">
        <div class="brand">
          <a id="title" target="_blank" href="https://github.com/tnychn/opencc-extension" rel="noreferrer">
            OpenCC
          </a>
          {version && (
            <span class="version-badge" title="Extension version">
              v{version}
            </span>
          )}
        </div>
        <nav class="header-actions">
          <button
            class="primary"
            title="Convert current page"
            disabled={converting || origin === target}
            onClick={handleConvertPage}
          >
            Convert Page
          </button>
        </nav>
      </header>

      <main class="app-main">
        <section class="panel panel-inline" aria-labelledby="direction-title">
          <span id="direction-title" class="panel-title">
            Direction
          </span>
          <div class="direction-row">
            <div class="select-group">
              <label for="origin" class="sr-only">
                Source
              </label>
              <select
                id="origin"
                aria-label="Source variant"
                value={origin}
                onChange={(e) => {
                  const val = (e.currentTarget as HTMLSelectElement).value as LocaleCode;
                  setOrigin(val);
                  if (textboxValue) scheduleTextboxConvert();
                }}
              >
                {Object.entries(LOCALE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button class="icon" title="Swap" onClick={handleSwap}>
              ⇄
            </button>
            <div class="select-group">
              <label for="target" class="sr-only">
                Target
              </label>
              <select
                id="target"
                aria-label="Target variant"
                value={target}
                onChange={(e) => {
                  const val = (e.currentTarget as HTMLSelectElement).value as LocaleCode;
                  setTarget(val);
                  if (textboxValue) scheduleTextboxConvert();
                }}
              >
                {Object.entries(LOCALE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div class="auto-toggle">
            <input id="auto" type="checkbox" checked={auto} onChange={handleAutoChange} />
            <label for="auto">Auto convert on load</label>
          </div>
        </section>

        <section class="panel" aria-labelledby="textbox-title">
          <div class="panel-header">
            <span id="textbox-title" class="panel-title">
              Text Sandbox
            </span>
            <div class="panel-tools">
              <button class="icon" title="Reset textbox" onClick={handleReset}>
                ⟳
              </button>
            </div>
          </div>
          <textarea
            ref={textboxRef}
            id="textbox"
            placeholder="Paste or type text here to convert…"
            aria-label="Conversion textbox"
            value={textboxValue}
            onInput={(e) => {
              setTextboxValue((e.currentTarget as HTMLTextAreaElement).value);
              scheduleTextboxConvert();
            }}
            onPaste={() => setTimeout(scheduleTextboxConvert, 0)}
            onChange={scheduleTextboxConvert}
          />
        </section>
      </main>

      <footer class="app-footer">
        {footerText ? (
          footerError ? (
            <span style="color: red; font-weight: bold;">{footerText}</span>
          ) : (
            <span>{footerText}</span>
          )
        ) : (
          <>
            <span class="footnote">
              Powered by{' '}
              <a target="_blank" href="https://github.com/BYVoid/OpenCC" rel="noreferrer">
                OpenCC
              </a>
            </span>
            <a class="repo-link" target="_blank" href="https://github.com/tnychn/opencc-extension" rel="noreferrer">
              Repository
            </a>
          </>
        )}
      </footer>
    </>
  );
}
