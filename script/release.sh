#! /bin/bash
npm version patch
npm run publish-npm
appVersion=`node -p -e "require('./package.json').version"
git push
git tag -a "v$appVersion" -m "auto release  $appVersion"
git push origin --tags