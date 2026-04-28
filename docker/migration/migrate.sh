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


echo Seeding assets in data..."

mkdir -p /app/data/master

echo "Contents of /migration/data:"
ls -lah /migration/data || true

cp -rv /migration/data/* /app/data/master



echo "📁 Seeding framework for tenant ${TENANT_ID} ..."
mkdir -p /app/temp/${TENANT_ID}
cp -r /migration/framework/${TENANT_ID}/adapt_framework  /app/temp/${TENANT_ID}/

echo "📁 Preparing plugin type directories..."
#mkdir -p /app/storage/plugins/{content,component,extension,theme,output,auth}

touch "$FLAG_FILE"
echo "✅ Migration complete."