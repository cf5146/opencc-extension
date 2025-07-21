# Contributing to OpenCC Extension

Thank you for your interest in contributing to the OpenCC Extension! This document outlines the development workflow and CI/CD processes.

## Development Workflow

### Setting up the development environment

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development mode: `npm run start:firefox` (or `:chromium` for Chrome/Edge)

**Note:** If you encounter package-lock.json sync issues, run:
- Windows: `sync-lockfile.bat`  
- Mac/Linux: `bash sync-lockfile.sh`

### Available Scripts

- `npm run build` - Build the extension for development
- `npm run build:watch` - Build in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run validate` - Run both linting and format checks
- `npm run dist` - Build production packages for all browsers

### Browser-specific commands

- `npm run start:firefox` - Start Firefox development server
- `npm run start:chromium` - Start Chrome development server
- `npm run start:edge` - Start Edge development server

## CI/CD Workflows

The project uses GitHub Actions for continuous integration and deployment:

### 1. CI/CD Workflow (`ci.yml`)

**Triggers:** Push to `main`/`develop`, Pull Requests to `main`, Releases

**Jobs:**
- **Lint and Test:** ESLint, Prettier, manifest validation
- **Build:** Creates extension packages for Chrome, Firefox, and Edge
- **Release:** Uploads release artifacts when a release is published
- **Firefox Submission:** Automatically submits to Firefox Add-ons (requires API keys)

### 2. Code Quality Workflow (`code-quality.yml`)

**Triggers:** Push to `main`/`develop`, Pull Requests to `main`

**Jobs:**
- **Security Audit:** Checks for security vulnerabilities
- **Dependency Review:** Reviews new dependencies in PRs
- **CodeQL Analysis:** Automated security analysis

### 3. Development Workflow (`development.yml`)

**Triggers:** Push/PRs to `develop` branch

**Jobs:**
- **Development Build:** Builds and validates extension in development mode
- **Preview Changes:** Creates preview builds for PRs with download links

### 4. Version Management Workflow (`version.yml`)

**Triggers:** Manual dispatch

**Features:**
- Automated version bumping (patch/minor/major)
- Updates all manifest files
- Generates changelog from commit messages
- Creates GitHub releases

## Release Process

### Automated Release (Recommended)

1. Use the "Version Management" workflow from the Actions tab
2. Select version bump type (patch/minor/major)
3. The workflow will:
   - Update version in `package.json` and manifest files
   - Generate changelog
   - Create a Git tag and GitHub release
   - Trigger the build and deployment process

### Manual Release

1. Update version in `package.json` and all manifest files
2. Commit changes: `git commit -m "chore: bump version to x.x.x"`
3. Create tag: `git tag vx.x.x`
4. Push: `git push && git push --tags`
5. Create GitHub release from the tag

## GitHub Secrets Required

For full automation, configure these repository secrets:

### Firefox Add-ons Submission (Optional)
- `FIREFOX_API_KEY` - Firefox Add-ons API key
- `FIREFOX_API_SECRET` - Firefox Add-ons API secret

**To enable Firefox submission:**
1. Get API credentials from [Firefox Add-ons Developer Hub](https://addons.mozilla.org/developers/)
2. Go to your repository Settings → Secrets and variables → Actions
3. Add the `FIREFOX_API_KEY` and `FIREFOX_API_SECRET` secrets
4. The `firefox-submission.yml` workflow will automatically run on releases

**Manual Firefox submission:**
- Use the Firefox build artifact from releases
- Upload to [Firefox Add-ons Developer Hub](https://addons.mozilla.org/developers/)

## Commit Message Convention

Use conventional commit messages for automatic changelog generation:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks

## Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes
3. Ensure all checks pass: `npm run validate`
4. Create a pull request to `develop`
5. Preview builds will be automatically generated
6. After review and approval, merge to `develop`
7. For releases, create a PR from `develop` to `main`

## Browser Store Submission

### Chrome Web Store
- Manual submission required
- Use the Chrome build artifact from releases

### Firefox Add-ons
- Automated submission via workflow (if API keys configured)
- Manual submission fallback available

### Edge Add-ons
- Manual submission required
- Use the Edge build artifact from releases

## Testing

The extension is automatically tested in the CI pipeline:

- Manifest validation
- Build verification
- Extension loading tests
- Security audits

For local testing:
- Load the extension in developer mode
- Test core functionality
- Verify compatibility across browsers
