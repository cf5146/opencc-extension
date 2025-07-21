@echo off
REM Script to sync package-lock.json with package.json
REM Run this if you encounter npm ci errors

echo Syncing package-lock.json with package.json...

REM Remove existing package-lock.json and node_modules
echo Cleaning existing lock file and node_modules...
if exist package-lock.json del package-lock.json
if exist node_modules rmdir /s /q node_modules

REM Generate fresh package-lock.json
echo Generating fresh package-lock.json...
npm install

echo Package-lock.json has been updated!
echo You can now use 'npm ci' for faster installs in CI/CD
