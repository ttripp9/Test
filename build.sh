#!/usr/bin/env sh
# Builds the deployable site (public/index.html) from src/landing.html.
set -eu
mkdir -p public
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n'
  cat src/landing.html
  printf '\n</body>\n</html>\n'
} > public/index.html
echo "Built public/index.html"
