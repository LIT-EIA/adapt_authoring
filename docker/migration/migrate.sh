#!/bin/bash
set -e

TENANT_ID="68e3f614ba3f6e060810da92"
FLAG_FILE="/app/storage/migration_done.flag"

if [ -f "$FLAG_FILE" ]; then
  echo "✅ Migration already completed. Skipping..."
  exit 0
fi

echo "📦 Restoring MongoDB dump..."
mongorestore --host "${MONGO_HOST:-mongo}" --port 27017 /migration/dump

echo "📁 Seeding assets..."
mkdir -p /app/storage/data
cp -r /migration/data/* /app/storage/data/

echo "📁 Seeding framework..."
mkdir -p /app/storage/framework
cp -r /migration/framework/${TENANT_ID} /app/storage/temp/

echo "📁 Preparing plugin type directories..."
mkdir -p /app/storage/plugins/{content,component,extension,theme,output,auth}

touch "$FLAG_FILE"
echo "✅ Migration complete."