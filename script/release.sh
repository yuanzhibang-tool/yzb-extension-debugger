#! /bin/bash
npm version patch
npm run publish-npm
appVersion=`node -p -e "require('./package.json').version"`
git push
git push origin --tags