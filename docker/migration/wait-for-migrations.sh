#!/bin/bash
set -e

FLAG_FILE="/app/storage/migration_done.flag"

  echo "🔍 Checking for migration flag at $FLAG_FILE..."

  # If flag already exists, no need to wait
  if [ -f "$FLAG_FILE" ]; then
    echo "Migration already completed. Starting app..."
  else
    echo "⏳ Waiting for migration to complete..."

    # Wait until the flag file exists
    while [ ! -f "$FLAG_FILE" ]; do
      echo "Still waiting for migration..."
      sleep 2
    done

    echo "Migration completed. Starting app..."
  fi

# Start application
cd /app/storage/
exec npm start
