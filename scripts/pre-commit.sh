#!/bin/bash
# Pre-commit hook: run TypeScript type checks before allowing commit
# Runs tsc via Docker (no local node_modules needed)

set -e

echo "🔍 Running frontend type check..."
docker compose exec -T frontend npx tsc --noEmit 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Frontend type check failed. Fix errors before committing."
  exit 1
fi

echo "🔍 Running backend type check..."
docker compose exec -T backend npx tsc --noEmit 2>&1
if [ $? -ne 0 ]; then
  echo "❌ Backend type check failed. Fix errors before committing."
  exit 1
fi

echo "✅ All type checks passed."
