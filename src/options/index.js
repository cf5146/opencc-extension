const $whitelist = document.getElementById("whitelist");

let timeout;

// Optimized debounce function
const debounce = (func, delay) => {
  return (...args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
};

// Process and save whitelist with optimized logic
const processWhitelist = debounce(() => {
  $whitelist.value = $whitelist.value.trim();
  const whitelist = $whitelist.value
    .split("\n")
    .filter(Boolean)
    .map((pattern) => pattern.trim().replaceAll("*", "[^ ]*"));
  chrome.storage.local.set({ whitelist });
}, 300); // Reduced debounce delay for better responsiveness

$whitelist.addEventListener("input", () => {
  // Normalize line breaks immediately for better UX
  $whitelist.value = $whitelist.value
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  processWhitelist();
});

chrome.storage.local.get({ whitelist: [] }).then(({ whitelist }) => {
  $whitelist.value = whitelist.map((p) => p.replaceAll("[^ ]*", "*")).join("\n");
});
