#!/bin/bash
set -e

# Configure PostgreSQL to accept connections from localhost
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" /etc/postgresql/18/main/postgresql.conf || true
grep -q "host all all all trust" /etc/postgresql/18/main/pg_hba.conf || echo "host all all all trust" >> /etc/postgresql/18/main/pg_hba.conf

service postgresql restart

# Setup user and database
su - postgres -c "psql -c \"CREATE USER mailpulse WITH PASSWORD 'mailpulse_password' SUPERUSER;\" 2>/dev/null || true"
su - postgres -c "psql -c \"CREATE DATABASE mailpulse_db OWNER mailpulse;\" 2>/dev/null || true"

# Setup Redis
sed -i "s/^bind 127.0.0.1/bind 0.0.0.0/g" /etc/redis/redis.conf || true
grep -q "requirepass redis_password" /etc/redis/redis.conf || echo "requirepass redis_password" >> /etc/redis/redis.conf
service redis-server restart

echo "INFRASTRUCTURE_STARTED_SUCCESSFULLY"
