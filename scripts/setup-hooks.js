#!/usr/bin/env node
/**
 * Git hooks setup for code quality
 * Run: npm run setup-hooks
 */

import { writeFileSync, chmodSync } from "fs";
import { join } from "path";

const preCommitHook = `#!/bin/sh
# Pre-commit hook for code quality
echo "🔍 Running code quality checks..."

# Run ESLint
npm run lint
LINT_EXIT_CODE=$?

# Run Prettier check
npm run format:check
PRETTIER_EXIT_CODE=$?

# Check if any check failed
if [ $LINT_EXIT_CODE -ne 0 ] || [ $PRETTIER_EXIT_CODE -ne 0 ]; then
  echo "❌ Code quality checks failed!"
  echo "💡 Run 'npm run code-fix' to automatically fix issues"
  exit 1
fi

echo "✅ All code quality checks passed!"
exit 0
`;

try {
  // Write pre-commit hook
  const hookPath = join(".git", "hooks", "pre-commit");
  writeFileSync(hookPath, preCommitHook);
  chmodSync(hookPath, 0o755);

  console.log("✅ Git pre-commit hook installed successfully!");
  console.log("💡 Code quality checks will now run automatically before each commit");
} catch (error) {
  console.error("❌ Failed to install git hooks:", error.message);
  console.log("💡 Make sure you are in a git repository");
}
