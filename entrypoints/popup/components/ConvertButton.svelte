<script lang="ts">
  export let busy = false;
  export let isConverted = false;
  export let onConvert: () => void | Promise<void>;
  export let onRestore: () => void | Promise<void>;
</script>

<button
  class="primary-action"
  type="button"
  data-testid="convert-button"
  disabled={busy}
  on:click={isConverted ? onRestore : onConvert}
>
  {#if busy}
    Working…
  {:else if isConverted}
    Restore
  {:else}
    Convert
  {/if}
</button>
