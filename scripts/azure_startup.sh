#!/usr/bin/env bash
# Startup command for the Azure App Service (copied to the package root as startup.sh).
#
# HINDSIGHT_CACHE_DIR points at /home, the App Service's persistent share, so weather downloaded for
# custom fields survives restarts and redeployments. The demonstration farms' NASA POWER, SoilGrids
# and MODIS files ship inside the package, so they are copied there first (only files that are
# missing or older are written). If the share cannot be used, the app falls back to the packaged cache.
set -u

if [ -n "${HINDSIGHT_CACHE_DIR:-}" ]; then
  if mkdir -p "$HINDSIGHT_CACHE_DIR" && cp -u backend/data/cache/*.json "$HINDSIGHT_CACHE_DIR"/; then
    echo "HindSight cache: $HINDSIGHT_CACHE_DIR ($(ls "$HINDSIGHT_CACHE_DIR" | wc -l) files)"
  else
    echo "HindSight cache: could not prepare $HINDSIGHT_CACHE_DIR; using the packaged cache instead"
    unset HINDSIGHT_CACHE_DIR
  fi
fi

# One process: analysis jobs are kept in memory, so several workers would lose them.
exec python -m uvicorn backend.api:app --host 0.0.0.0 --port "${PORT:-8000}"
