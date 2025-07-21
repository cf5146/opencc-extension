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

### 5. Firefox Add-ons Submission (`firefox-submission.yml`)

- **Purpose:** Optional Firefox Add-ons store submission
- **Triggers:** GitHub releases, manual dispatch
- **Features:**
  - Builds and signs Firefox extension
  - Submits to Firefox Add-ons (requires API credentials)
  - Creates signed extension artifacts

### 2. Code Quality Checks (`code-quality.yml`)
- **Purpose:** Security and dependency analysis
- **Triggers:** Push and PRs to `main`/`develop`
- **Features:**
  - npm audit security checks
  - Dependency review for PRs
  - CodeQL security analysis

### 3. Development Environment (`development.yml`)
- **Purpose:** Development branch and PR previews
- **Triggers:** Push and PRs to `develop`
- **Features:**
  - Development mode builds
  - PR preview artifact generation
  - Automated PR comments with download links

### 4. Version Management (`version.yml`)
- **Purpose:** Automated versioning and releases
- **Triggers:** Manual workflow dispatch
- **Features:**
  - Version bumping (patch/minor/major)
  - Manifest file updates
  - Changelog generation
  - GitHub release creation

## Key Features

✅ **Automated Testing:** ESLint, Prettier, manifest validation  
✅ **Multi-Browser Support:** Chrome, Firefox, Edge builds  
✅ **Security Scanning:** npm audit, CodeQL, dependency review  
✅ **Preview Builds:** PR artifacts with download links  
✅ **Automated Releases:** Version bumping and changelog generation  
✅ **Store Submission:** Firefox Add-ons integration ready  

## Configuration Files

- `.github/workflows/ci.yml` - Main CI/CD pipeline
- `.github/workflows/code-quality.yml` - Security and quality checks
- `.github/workflows/development.yml` - Development environment
- `.github/workflows/version.yml` - Version management
- `.github/changelog-config.json` - Changelog generation config
- `.audit-ci.json` - Security audit configuration
- `CONTRIBUTING.md` - Developer documentation

## Required Secrets (Optional)

To enable Firefox Add-ons automatic submission:
- `FIREFOX_API_KEY`
- `FIREFOX_API_SECRET`

## Next Steps

1. **Test the workflows:** Create a test PR to verify the development workflow
2. **Configure secrets:** Add Firefox API keys if automatic submission is desired
3. **Create first release:** Use the version management workflow to create v0.4.1
4. **Update documentation:** Customize CONTRIBUTING.md for your specific needs

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

The workflows are now configured and ready to use!
