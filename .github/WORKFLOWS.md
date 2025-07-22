# GitHub Workflows Configuration Summary

This document summarizes the GitHub Actions workflows configured for the OpenCC Extension project.

## Workflows Overview

### 1. Main CI/CD Pipeline (`ci.yml`)
- **Purpose:** Main build, test, and release pipeline
- **Triggers:** 
  - Push to `main` and `develop` branches
  - Pull requests to `main`
  - GitHub releases
- **Features:**
  - ESLint and Prettier validation
  - Multi-browser builds (Chrome, Firefox, Edge)
  - Automated release artifact generation
  - **Updated:** Now uses pnpm instead of npm

### 2. Code Quality Checks (`code-quality.yml`)
- **Purpose:** Security and dependency analysis
- **Triggers:** Push and PRs to `main`/`develop`
- **Features:**
  - pnpm audit security checks
  - Dependency review for PRs
  - CodeQL security analysis
  - **Updated:** Now uses pnpm instead of npm

### 3. Development Environment (`development.yml`)
- **Purpose:** Development branch and PR previews
- **Triggers:** Push and PRs to `develop`
- **Features:**
  - Development mode builds
  - PR preview artifact generation
  - Automated PR comments with download links
  - **Updated:** Now uses pnpm instead of npm

### 4. Version Management (`version.yml`)
- **Purpose:** Automated versioning and releases
- **Triggers:** Manual workflow dispatch
- **Features:**
  - Version bumping (patch/minor/major)
  - Manifest file updates
  - Changelog generation
  - GitHub release creation
  - **Updated:** Now uses pnpm and updates pnpm-lock.yaml

### 5. Firefox Add-ons Submission (`firefox-submission.yml`)
- **Purpose:** Firefox Add-ons store submission
- **Triggers:** GitHub releases, manual dispatch
- **Features:**
  - Builds and signs Firefox extension
  - Submits to Firefox Add-ons (requires API credentials)
  - Creates signed extension artifacts
  - **Updated:** Now uses pnpm instead of npm

### 6. Chrome Web Store Submission (`chrome-submission.yml`) ✨ **NEW**
- **Purpose:** Chrome Web Store submission
- **Triggers:** GitHub releases, manual dispatch
- **Features:**
  - Builds Chrome extension
  - Submits to Chrome Web Store (requires API credentials)
  - Creates packaged extension artifacts

### 7. Dependency Updates (`dependency-updates.yml`) ✨ **NEW**
- **Purpose:** Automated dependency maintenance
- **Triggers:** Weekly schedule (Mondays), manual dispatch
- **Features:**
  - Automatic dependency updates
  - Creates PRs for dependency changes
  - Runs tests on updated dependencies
  - Automated commit and PR creation

## Key Features

✅ **Automated Testing:** ESLint, Prettier, manifest validation  
✅ **Multi-Browser Support:** Chrome, Firefox, Edge builds  
✅ **Security Scanning:** pnpm audit, CodeQL, dependency review  
✅ **Preview Builds:** PR artifacts with download links  
✅ **Automated Releases:** Version bumping and changelog generation  
✅ **Store Submission:** Firefox Add-ons and Chrome Web Store integration  
✅ **Dependency Management:** Automated weekly dependency updates  
✅ **Package Manager:** Consistent pnpm usage across all workflows  

## Configuration Files

- `.github/workflows/ci.yml` - Main CI/CD pipeline
- `.github/workflows/code-quality.yml` - Security and quality checks
- `.github/workflows/development.yml` - Development environment
- `.github/workflows/version.yml` - Version management
- `.github/workflows/firefox-submission.yml` - Firefox Add-ons submission
- `.github/workflows/chrome-submission.yml` - Chrome Web Store submission
- `.github/workflows/dependency-updates.yml` - Automated dependency updates
- `.github/changelog-config.json` - Changelog generation config
- `.audit-ci.json` - Security audit configuration
- `CONTRIBUTING.md` - Developer documentation

## Required Secrets (Optional)

To enable store submissions:
- `FIREFOX_API_KEY` - Firefox Add-ons API key
- `FIREFOX_API_SECRET` - Firefox Add-ons API secret
- `CHROME_WEBSTORE_KEYS` - Chrome Web Store API keys (JSON format)

## Improvements Made

### Package Manager Migration
- **Migrated from npm to pnpm:** All workflows now use pnpm for better performance and consistency
- **Added proper caching:** Uses pnpm cache for faster CI runs
- **Frozen lockfile:** Uses `--frozen-lockfile` for reproducible builds

### New Workflows Added
- **Chrome Web Store submission:** Automated Chrome extension publishing
- **Dependency updates:** Weekly automated dependency maintenance

### Enhanced Features
- **Better error handling:** Improved workflow reliability
- **Consistent tooling:** All workflows use the same Node.js and pnpm versions
- **Security improvements:** Better secret handling and validation

## Next Steps

1. **Test the workflows:** Create a test PR to verify all workflows work correctly
2. **Configure secrets:** Add store API keys if automatic submission is desired
3. **Create first release:** Use the version management workflow to create a new release
4. **Monitor dependency updates:** Review weekly dependency update PRs

## Usage Examples

### Creating a Release
1. Go to Actions tab
2. Select "Version Management" workflow
3. Click "Run workflow"
4. Choose version type (patch/minor/major)
5. Wait for automated release creation

### Testing Changes
1. Create PR to `develop` branch
2. Preview builds will be generated automatically
3. Download artifacts from Actions tab
4. Test in browser developer mode

### Store Submission
1. Create a GitHub release
2. Workflows will automatically build and submit to stores
3. Monitor the Actions tab for submission status

The workflows are now optimized and ready to use with pnpm!
