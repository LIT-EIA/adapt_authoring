FROM mongo:6.0.11

WORKDIR /migration

# Copy migration inputs from new-migrations
COPY new-migrations/dump ./dump
COPY new-migrations/data ./data
COPY new-migrations/framework ./framework

# Copy migration script
COPY docker/migration/migrate.sh ./migrate.sh

RUN chmod +x ./migrate.sh

CMD ["./migrate.sh"]