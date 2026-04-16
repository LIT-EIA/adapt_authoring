FROM mongo:6.0.11

# Set the working directory
WORKDIR /migration

# Install apt-utils and the MongoDB shell
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    mongodb-clients && \
    rm -rf /var/lib/apt/lists/*

# Copy migration inputs from new-migrations
COPY new-migrations/dump ./dump
COPY new-migrations/data ./data
COPY new-migrations/framework ./framework

# Copy migration script
COPY docker/migration/migrate.sh ./migrate.sh

RUN chmod +x ./migrate.sh

# Command to execute the migration script
CMD ["./migrate.sh"]