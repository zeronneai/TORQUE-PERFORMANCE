#!/bin/sh
set -e
cd $CI_PRIMARY_REPOSITORY_PATH
npm install
npx cap sync ios
