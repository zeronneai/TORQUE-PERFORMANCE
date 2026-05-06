#!/bin/sh
cd $CI_PRIMARY_REPOSITORY_PATH
brew install node || true
npm install || true
npm run build || true
npx cap sync ios || true
xcodebuild -resolvePackageDependencies || true
