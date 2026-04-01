import { useState, useEffect, useCallback } from 'preact/hooks';
import {
  originSetting,
  targetSetting,
  autoSetting,
  whitelistSetting,
  textboxSizeSetting,
} from '../utils/storage';
import type { LocaleCode } from '../utils/storage';

interface Settings {
  origin: LocaleCode;
  target: LocaleCode;
  auto: boolean;
  whitelist: string[];
  textboxSize: { width: number | null; height: number | null };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    origin: 'cn',
    target: 'hk',
    auto: false,
    whitelist: [],
    textboxSize: { width: null, height: null },
  });

  useEffect(() => {
    // Load initial values
    Promise.all([
      originSetting.getValue(),
      targetSetting.getValue(),
      autoSetting.getValue(),
      whitelistSetting.getValue(),
      textboxSizeSetting.getValue(),
    ]).then(([origin, target, auto, whitelist, textboxSize]) => {
      setSettings({ origin, target, auto, whitelist, textboxSize });
    });

    // Watch for changes from other contexts
    const unwatchOrigin = originSetting.watch((val) => setSettings((s) => ({ ...s, origin: val })));
    const unwatchTarget = targetSetting.watch((val) => setSettings((s) => ({ ...s, target: val })));
    const unwatchAuto = autoSetting.watch((val) => setSettings((s) => ({ ...s, auto: val })));
    const unwatchWhitelist = whitelistSetting.watch((val) => setSettings((s) => ({ ...s, whitelist: val })));
    const unwatchTextboxSize = textboxSizeSetting.watch((val) =>
      setSettings((s) => ({ ...s, textboxSize: val })),
    );

    return () => {
      unwatchOrigin();
      unwatchTarget();
      unwatchAuto();
      unwatchWhitelist();
      unwatchTextboxSize();
    };
  }, []);

  const setOrigin = useCallback((val: LocaleCode) => {
    originSetting.setValue(val);
    setSettings((s) => ({ ...s, origin: val }));
  }, []);

  const setTarget = useCallback((val: LocaleCode) => {
    targetSetting.setValue(val);
    setSettings((s) => ({ ...s, target: val }));
  }, []);

  const setAuto = useCallback((val: boolean) => {
    autoSetting.setValue(val);
    setSettings((s) => ({ ...s, auto: val }));
  }, []);

  const setTextboxSize = useCallback((val: { width: number | null; height: number | null }) => {
    textboxSizeSetting.setValue(val);
    setSettings((s) => ({ ...s, textboxSize: val }));
  }, []);

  return {
    ...settings,
    setOrigin,
    setTarget,
    setAuto,
    setTextboxSize,
  };
}
