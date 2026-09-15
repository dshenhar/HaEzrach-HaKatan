#!/bin/bash
set -e

echo "========================================="
echo "Starting database initialization script..."
echo "========================================="

# Flag file to track if migration has been done
MIGRATION_FLAG="/var/lib/postgresql/data/.migration_done"

# Check if migration has already been completed
if [ -f "$MIGRATION_FLAG" ]; then
    echo "✓ Database migration already completed on previous startup"
    echo "Skipping restoration..."
    exit 0
fi

echo "POSTGRES_USER: $POSTGRES_USER"
echo "POSTGRES_DB: $POSTGRES_DB"

# List files in init directory
echo "Files in /docker-entrypoint-initdb.d/:"
ls -lah /docker-entrypoint-initdb.d/

# Check if dump file exists
if [ -f "/docker-entrypoint-initdb.d/db360.dump" ]; then
    echo "Found db360.dump - starting restoration..."
    echo "File size: $(du -h /docker-entrypoint-initdb.d/db360.dump | cut -f1)"
    
    # Restore the dump
    if pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v /docker-entrypoint-initdb.d/db360.dump 2>&1; then
        echo "========================================="
        echo "✓ Database restore completed successfully!"
        echo "========================================="
        
        # Create flag file to prevent re-migration
        touch "$MIGRATION_FLAG"
        echo "✓ Migration flag created - future restarts will skip restoration"
    else
        echo "ERROR: Database restore failed!"
        exit 1
    fi
else
    echo "⚠ No db360.dump file found in /docker-entrypoint-initdb.d/"
    echo "Available files:"
    ls -la /docker-entrypoint-initdb.d/
fi

echo "========================================="
echo "Database initialization complete"
echo "========================================="

