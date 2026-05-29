<script lang="ts">
  export let label: string;
  export let description: string;
  export let patterns: string[];
  export let onUpdate: (patterns: string[]) => void | Promise<void>;

  let draft = '';

  async function addPattern(): Promise<void> {
    const pattern = draft.trim();
    if (!pattern || patterns.includes(pattern)) {
      draft = '';
      return;
    }

    await onUpdate([...patterns, pattern]);
    draft = '';
  }

  async function removePattern(pattern: string): Promise<void> {
    await onUpdate(patterns.filter((item) => item !== pattern));
  }
</script>

<div class="rule-editor">
  <h3>{label}</h3>
  <p>{description}</p>
  <div class="inline-form">
    <input
      bind:value={draft}
      placeholder="*.example.com"
      on:keydown={(event) => event.key === 'Enter' && addPattern()}
    />
    <button type="button" on:click={addPattern}>Add</button>
  </div>

  {#if patterns.length === 0}
    <p class="empty">No patterns configured.</p>
  {:else}
    <ul>
      {#each patterns as pattern (pattern)}
        <li>
          <code>{pattern}</code>
          <button type="button" on:click={() => removePattern(pattern)}>Remove</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
