<script lang="ts">
  export let enabled = false;
  export let onChange: () => void | Promise<void>;
</script>

<label class="toggle-row">
  <span>
    <strong>Auto Mode</strong>
    <small>Convert this site automatically on future visits.</small>
  </span>
  <input type="checkbox" bind:checked={enabled} on:change={onChange} />
</label>
