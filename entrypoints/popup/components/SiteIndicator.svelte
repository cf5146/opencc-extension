<script lang="ts">
  import { VARIANTS } from '@/lib/constants';
  import type { ExtensionSettings } from '@/lib/storage';

  export let hostname = '';
  export let settings: ExtensionSettings;
</script>

<div class="site-indicator">
  <span>{hostname || 'Current tab'}</span>
  <strong
    >{VARIANTS[settings.origin].code.toUpperCase()} → {VARIANTS[
      settings.target
    ].code.toUpperCase()}</strong
  >
</div>
