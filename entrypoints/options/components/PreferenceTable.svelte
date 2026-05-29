<script lang="ts">
  import { VARIANTS } from '@/lib/constants';
  import type { SitePreference } from '@/lib/storage';

  export let preferences: Record<string, SitePreference>;
  export let onRemove: (hostname: string) => void | Promise<void>;

  $: entries = Object.entries(preferences).sort(([left], [right]) => left.localeCompare(right));
</script>

{#if entries.length === 0}
  <p class="empty">No per-site preferences have been saved yet.</p>
{:else}
  <table>
    <thead>
      <tr>
        <th>Domain</th>
        <th>Conversion</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each entries as [hostname, preference] (hostname)}
        <tr>
          <td>{hostname}</td>
          <td>{VARIANTS[preference.origin].label} → {VARIANTS[preference.target].label}</td>
          <td><button type="button" on:click={() => onRemove(hostname)}>Remove</button></td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
