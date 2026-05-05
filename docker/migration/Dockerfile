# syntax=docker/dockerfile:1.7

FROM mongo:6.0.11

WORKDIR /migration

# ✅ Copy files first
COPY new-migrations/dump ./dump
COPY new-migrations/data ./data
COPY new-migrations/framework ./framework
COPY docker/migration/migrate.sh ./migrate.sh

# ✅ Fix permissions + make script executable
RUN chmod +x ./migrate.sh \
    && chown -R mongodb:mongodb /migration

# ✅ Drop privileges (Mongo image uses mongodb user)
USER mongodb

# ✅ Run migration
CMD ["./migrate.sh"]