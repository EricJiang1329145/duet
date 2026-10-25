#!/usr/bin/env bash
# Cloudflare Workers assets must be a dedicated directory. Keep the game's
# sources in place and expose only the browser-facing files through symlinks.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf public
mkdir -p public
ln -s ../index.html public/index.html
ln -s ../src public/src
ln -s ../styles public/styles

mkdir -p worker/dev-assets
ln -sfn ../../index.html worker/dev-assets/index.html
ln -sfn ../../src worker/dev-assets/src
ln -sfn ../../styles worker/dev-assets/styles

echo "public/ ready: $(find -L public -type f | wc -l | tr -d ' ') files"
echo "worker/dev-assets/ ready for wrangler dev"
