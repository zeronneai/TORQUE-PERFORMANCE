#!/bin/sh

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || true
fi

# Install Node.js
brew install node || true

# Install dependencies and sync Capacitor
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install || true
npx cap sync ios || true

# Resolve Swift package dependencies so Package.resolved is up to date
cd "$CI_PRIMARY_REPOSITORY_PATH/ios/App"
xcodebuild -resolvePackageDependencies \
  -project App.xcodeproj \
  -clonedSourcePackagesDirPath "$CI_PRIMARY_REPOSITORY_PATH/.build/spm" || true
