<script lang="ts">
  import { VARIANT_CODES, VARIANTS, type VariantCode } from '@/lib/constants';

  export let origin: VariantCode;
  export let target: VariantCode;
  export let onChange: () => void | Promise<void>;
  export let onSwap: () => void | Promise<void>;
</script>

<div class="variant-grid">
  <label>
    <span>From</span>
    <select data-testid="origin-selector" bind:value={origin} on:change={onChange}>
      {#each VARIANT_CODES as code (code)}
        <option value={code}>{VARIANTS[code].label}</option>
      {/each}
    </select>
  </label>

  <button class="swap-button" type="button" aria-label="Swap variants" on:click={onSwap}>⇄</button>

  <label>
    <span>To</span>
    <select data-testid="target-selector" bind:value={target} on:change={onChange}>
      {#each VARIANT_CODES as code (code)}
        <option value={code}>{VARIANTS[code].label}</option>
      {/each}
    </select>
  </label>
</div>
