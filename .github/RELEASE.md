# Release Process Documentation

This document outlines the automated release process for the OpenCC Extension project.

## 🎯 Overview

The project has multiple CI/CD workflows that handle different aspects of the release process:

### Workflows

1. **`ci.yml`** - Main CI/CD pipeline that runs on pushes, PRs, and releases
2. **`release.yml`** - Dedicated release creation workflow
3. **`version.yml`** - Version management and automated release creation
4. **`quick-release.yml`** - Quick release from existing tags

## 🚀 Release Triggers

### Automatic Triggers

1. **Tag Push**: When you push a version tag (e.g., `v1.0.0`), it automatically:
   - Builds extensions for all browsers
   - Creates release packages
   - Generates checksums
   - Creates a GitHub release

2. **Version Workflow**: Manual trigger that:
   - Bumps version in `package.json` and manifest files
   - Creates a commit and tag
   - Triggers the release process

### Manual Triggers

1. **Release Workflow**: Manual workflow dispatch that allows:
   - Custom version specification
   - Draft/prerelease options
   - Full release package creation

2. **Quick Release**: Create release from existing tags

## 📦 Release Packages

Each release includes:

- **Chrome Extension**: `opencc-chrome-vX.X.X.zip`
- **Firefox Extension**: `opencc-firefox-vX.X.X.zip`
- **Edge Extension**: `opencc-edge-vX.X.X.zip`
- **Checksums**: `checksums.txt` for verification
- **Release Info**: `release-info.txt` with build metadata

## 🛠️ How to Create a Release

### Method 1: Automatic Version Bump

1. Go to **Actions** → **Version Management**
2. Click **Run workflow**
3. Select version bump type (patch/minor/major)
4. Click **Run workflow**

This will:

- Update version in all files
- Create a commit and tag
- Create a draft release with packages

### Method 2: Manual Release Creation

1. Go to **Actions** → **Create Release**
2. Click **Run workflow**
3. Enter version (e.g., `v1.0.0`)
4. Set draft/prerelease options if needed
5. Click **Run workflow**

### Method 3: Tag Push

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

This automatically triggers the release creation.

### Method 4: Quick Release (for existing tags)

1. Go to **Actions** → **Quick Release**
2. Enter existing tag name
3. Set options and run

## 📋 Release Checklist

Before creating a release:

- [ ] All tests pass
- [ ] Version numbers are updated in:
  - [ ] `package.json`
  - [ ] `src/manifest.chrome.json`
  - [ ] `src/manifest.firefox.json`
  - [ ] `src/manifest.edge.json`
- [ ] CHANGELOG is updated
- [ ] README is current
- [ ] All features are documented

## 🔍 Verification

After release creation:

1. **Check GitHub Release**: Verify all files are attached
2. **Download and Test**: Test each browser package
3. **Verify Checksums**:

   ```bash
   sha256sum -c checksums.txt
   ```

4. **Browser Store Submission**: If applicable, submit to stores

## 🏗️ Local Development

### Build for specific browser

```bash
pnpm dist:chrome   # Chrome only
pnpm dist:firefox  # Firefox only
pnpm dist:edge     # Edge only
```

### Build all browsers

```bash
pnpm dist          # All browsers
```

### Prepare release locally

```bash
pnpm release:prepare  # Build and organize for release
```

### Clean up

```bash
pnpm release:clean    # Remove build artifacts
```

## 🔧 Configuration

### Version Format

- Standard: `v1.0.0`
- Prerelease: `v1.0.0-beta`, `v1.0.0-alpha.1`

### Changelog Generation

Configured in `.github/changelog-config.json` with categories:

- 🚀 Features
- 🐛 Bug Fixes
- 📚 Documentation
- 🔧 Maintenance
- 🔒 Security
- ⚡ Performance
- 🎨 Style

## 🚨 Troubleshooting

### Common Issues

1. **Build Failure**: Check Node.js version and dependencies
2. **Version Conflicts**: Ensure version is unique and follows semver
3. **Permission Issues**: Verify GitHub token permissions
4. **Missing Files**: Check build output and file paths

### Debug Steps

1. Check workflow logs in GitHub Actions
2. Verify all required secrets are set
3. Test build locally first
4. Check manifest file validity

## 📚 Related Files

- `.github/workflows/ci.yml` - Main CI/CD pipeline
- `.github/workflows/release.yml` - Release creation
- `.github/workflows/version.yml` - Version management
- `.github/workflows/quick-release.yml` - Quick releases
- `.github/changelog-config.json` - Changelog configuration
- `build.mjs` - Build script
- `package.json` - Project configuration

## 🔗 Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Web-ext Documentation](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
- [Chrome Extension Store](https://chrome.google.com/webstore/developer/dashboard)
- [Firefox Add-ons](https://addons.mozilla.org/developers/)
- [Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge)
