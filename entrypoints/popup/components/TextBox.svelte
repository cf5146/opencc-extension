<script lang="ts">
  import { convertText } from '@/lib/converter';
  import type { VariantCode } from '@/lib/constants';

  export let origin: VariantCode;
  export let target: VariantCode;

  let input = '';

  $: output = input && origin !== target ? convertText(input, origin, target) : input;
</script>

<label class="textbox-label">
  <span>Input</span>
  <textarea bind:value={input} placeholder="Paste Chinese text here"></textarea>
</label>

<label class="textbox-label">
  <span>Output</span>
  <textarea readonly value={output} placeholder="Converted text appears here"></textarea>
</label>
