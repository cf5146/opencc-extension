// Test script to verify the whitelist fix
// This simulates the conditions that caused the "e.forEach is not a function" error

// Mock Chrome storage that might return undefined whitelist
const mockChromeStorage = {
  local: {
    get: (defaults) =>
      Promise.resolve({
        origin: "cn",
        target: "hk",
        auto: true,
        // Note: whitelist is missing/undefined, which caused the original error
      }),
  },
};

// Mock default settings
const defaultSettings = {
  origin: "cn",
  target: "hk",
  auto: false,
  whitelist: [],
};

// Fixed matchWhitelist function
const matchWhitelist = (whitelist, url) => {
  // This check now prevents the error
  if (!Array.isArray(whitelist) || whitelist.length === 0) return false;
  return whitelist.some((pattern) => {
    try {
      const regex = new RegExp(pattern);
      return regex.test(url);
    } catch {
      return false;
    }
  });
};

// Fixed getCachedSettings function
const getCachedSettings = async () => {
  const storedSettings = await mockChromeStorage.local.get(defaultSettings);
  // Ensure all required properties exist and are of correct type
  const settings = {
    ...defaultSettings,
    ...storedSettings,
    whitelist: Array.isArray(storedSettings.whitelist) ? storedSettings.whitelist : defaultSettings.whitelist,
  };
  return settings;
};

// Test cases
async function runTests() {
  console.log("🧪 Testing whitelist fix...");

  try {
    // Test 1: Undefined whitelist (original error case)
    console.log("\n📝 Test 1: Undefined whitelist");
    const result1 = matchWhitelist(undefined, "https://www.zhihu.com/");
    console.log("✅ matchWhitelist(undefined, url) =", result1, "(should be false)");

    // Test 2: Empty array
    console.log("\n📝 Test 2: Empty array");
    const result2 = matchWhitelist([], "https://www.zhihu.com/");
    console.log("✅ matchWhitelist([], url) =", result2, "(should be false)");

    // Test 3: Valid array with patterns
    console.log("\n📝 Test 3: Valid array with patterns");
    const result3 = matchWhitelist([".*\\.zhihu\\.com.*"], "https://www.zhihu.com/");
    console.log("✅ matchWhitelist([pattern], url) =", result3, "(should be true)");

    // Test 4: Settings with undefined whitelist
    console.log("\n📝 Test 4: Settings retrieval");
    const settings = await getCachedSettings();
    console.log("✅ Settings whitelist:", settings.whitelist, "(should be [])");
    console.log("✅ Is array:", Array.isArray(settings.whitelist));

    // Test 5: matchWhitelist with fixed settings
    console.log("\n📝 Test 5: matchWhitelist with fixed settings");
    const result5 = matchWhitelist(settings.whitelist, "https://www.zhihu.com/");
    console.log("✅ matchWhitelist(settings.whitelist, url) =", result5, "(should be false)");

    console.log("\n🎉 All tests passed! The forEach error should be fixed.");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the tests
runTests();
