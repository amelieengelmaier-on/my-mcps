#!/bin/bash
set -a
source "$(dirname "$0")/.env"
set +a
exec /opt/homebrew/bin/node --import tsx/esm "$(dirname "$0")/index.ts"
