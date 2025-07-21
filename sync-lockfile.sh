#!/usr/bin/env bash

# Script to sync package-lock.json with package.json
# Run this if you encounter npm ci errors

echo "Syncing package-lock.json with package.json..."

# Remove existing package-lock.json and node_modules
echo "Cleaning existing lock file and node_modules..."
rm -f package-lock.json
rm -rf node_modules

# Generate fresh package-lock.json
echo "Generating fresh package-lock.json..."
npm install

echo "Package-lock.json has been updated!"
echo "You can now use 'npm ci' for faster installs in CI/CD"
