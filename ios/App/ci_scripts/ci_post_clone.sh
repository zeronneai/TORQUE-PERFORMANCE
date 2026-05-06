#!/bin/sh
set -e

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install Node.js
brew install node

# Install dependencies and sync Capacitor
cd $CI_PRIMARY_REPOSITORY_PATH
npm install
npx cap sync ios
