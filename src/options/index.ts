const $whitelist = document.getElementById('whitelist') as HTMLTextAreaElement;

let timeout: number | undefined;
$whitelist.addEventListener('input', () => {
  $whitelist.value = $whitelist.value
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
  if (timeout) clearTimeout(timeout);
  timeout = window.setTimeout(() => {
    $whitelist.value = $whitelist.value.trim();
    const whitelist = $whitelist.value
      .split('\n')
      .filter(Boolean)
      .map((pattern) => pattern.replaceAll('*', '[^ ]*'));
    chrome.storage.local.set({ whitelist });
  }, 500);
});

chrome.storage.local.get({ whitelist: [] }).then(({ whitelist }) => {
  $whitelist.value = (whitelist as string[]).map((p) => p.replaceAll('[^ ]*', '*')).join('\n');
});
