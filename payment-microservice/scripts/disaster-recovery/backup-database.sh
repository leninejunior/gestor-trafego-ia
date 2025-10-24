#!/bin/bash

# Payment Service Database Backup Script
# This script creates full and incremental backups of the payment service database

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/payment-service}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-payment_service}"
DB_USER="${DB_USER:-payment_user}"
S3_BUCKET="${S3_BUCKET:-payment-service-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Create timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y%m%d)

# Create backup directory
mkdir -p "$BACKUP_DIR/full"
mkdir -p "$BACKUP_DIR/incremental"
mkdir -p "$BACKUP_DIR/wal"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to create full backup
create_full_backup() {
    log "Starting full database backup..."
    
    local backup_file="$BACKUP_DIR/full/full_backup_$TIMESTAMP.sql"
    
    # Create full backup with custom format for faster restore
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="$backup_file"
    
    if [ $? -eq 0 ]; then
        log "Full backup completed: $backup_file"
        
        # Create checksum
        sha256sum "$backup_file" > "$backup_file.sha256"
        
        # Upload to S3
        if command -v aws &> /dev/null; then
            aws s3 cp "$backup_file" "s3://$S3_BUCKET/full/"
            aws s3 cp "$backup_file.sha256" "s3://$S3_BUCKET/full/"
            log "Full backup uploaded to S3"
        fi
        
        return 0
    else
        log "ERROR: Full backup failed"
        return 1
    fi
}

# Function to create incremental backup
create_incremental_backup() {
    log "Starting incremental backup..."
    
    local backup_file="$BACKUP_DIR/incremental/incremental_backup_$TIMESTAMP.sql"
    local last_backup_time
    
    # Find the last backup time
    if [ -f "$BACKUP_DIR/.last_backup_time" ]; then
        last_backup_time=$(cat "$BACKUP_DIR/.last_backup_time")
    else
        # If no previous backup, use yesterday
        last_backup_time=$(date -d "yesterday" '+%Y-%m-%d %H:%M:%S')
    fi
    
    log "Creating incremental backup since: $last_backup_time"
    
    # Create incremental backup (transactions since last backup)
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --format=custom \
        --compress=9 \
        --verbose \
        --where="updated_at >= '$last_backup_time'" \
        --file="$backup_file"
    
    if [ $? -eq 0 ]; then
        log "Incremental backup completed: $backup_file"
        
        # Update last backup time
        date '+%Y-%m-%d %H:%M:%S' > "$BACKUP_DIR/.last_backup_time"
        
        # Upload to S3
        if command -v aws &> /dev/null; then
            aws s3 cp "$backup_file" "s3://$S3_BUCKET/incremental/"
            log "Incremental backup uploaded to S3"
        fi
        
        return 0
    else
        log "ERROR: Incremental backup failed"
        return 1
    fi
}

# Function to backup WAL files
backup_wal_files() {
    log "Backing up WAL files..."
    
    local wal_dir="/var/lib/postgresql/data/pg_wal"
    local wal_backup_dir="$BACKUP_DIR/wal/$DATE"
    
    if [ -d "$wal_dir" ]; then
        mkdir -p "$wal_backup_dir"
        
        # Copy WAL files
        find "$wal_dir" -name "*.wal" -newer "$BACKUP_DIR/.last_wal_backup" 2>/dev/null | \
        while read -r wal_file; do
            cp "$wal_file" "$wal_backup_dir/"
            log "Copied WAL file: $(basename "$wal_file")"
        done
        
        # Update timestamp
        touch "$BACKUP_DIR/.last_wal_backup"
        
        # Upload to S3
        if command -v aws &> /dev/null; then
            aws s3 sync "$wal_backup_dir" "s3://$S3_BUCKET/wal/$DATE/"
            log "WAL files uploaded to S3"
        fi
    else
        log "WARNING: WAL directory not found: $wal_dir"
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Remove local backups
    find "$BACKUP_DIR/full" -name "*.sql" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR/incremental" -name "*.sql" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR/wal" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} +
    
    # Remove S3 backups (if AWS CLI is available)
    if command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" '+%Y-%m-%d')
        aws s3 ls "s3://$S3_BUCKET/full/" | \
        awk -v cutoff="$cutoff_date" '$1 < cutoff {print $4}' | \
        while read -r file; do
            aws s3 rm "s3://$S3_BUCKET/full/$file"
            log "Removed old S3 backup: $file"
        done
    fi
    
    log "Cleanup completed"
}

# Function to verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log "Verifying backup integrity: $backup_file"
    
    # Check if file exists and is not empty
    if [ ! -s "$backup_file" ]; then
        log "ERROR: Backup file is empty or does not exist"
        return 1
    fi
    
    # Verify checksum if available
    if [ -f "$backup_file.sha256" ]; then
        if sha256sum -c "$backup_file.sha256"; then
            log "Backup integrity verified"
            return 0
        else
            log "ERROR: Backup integrity check failed"
            return 1
        fi
    fi
    
    # Test restore to temporary database (optional, resource intensive)
    if [ "$VERIFY_RESTORE" = "true" ]; then
        local test_db="test_restore_$(date +%s)"
        
        log "Testing restore to temporary database: $test_db"
        
        # Create test database
        createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db"
        
        # Restore backup
        pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db" "$backup_file"
        
        if [ $? -eq 0 ]; then
            log "Test restore successful"
            # Drop test database
            dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db"
            return 0
        else
            log "ERROR: Test restore failed"
            dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db" 2>/dev/null
            return 1
        fi
    fi
    
    return 0
}

# Function to send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [ -n "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"status\":\"$status\",\"message\":\"$message\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
    fi
    
    if [ -n "$EMAIL_RECIPIENT" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "Payment Service Backup $status" "$EMAIL_RECIPIENT"
    fi
}

# Main execution
main() {
    log "Starting backup process..."
    
    local backup_type="${1:-full}"
    local success=true
    
    case "$backup_type" in
        "full")
            if ! create_full_backup; then
                success=false
            fi
            ;;
        "incremental")
            if ! create_incremental_backup; then
                success=false
            fi
            ;;
        "wal")
            backup_wal_files
            ;;
        "all")
            if ! create_full_backup; then
                success=false
            fi
            if ! create_incremental_backup; then
                success=false
            fi
            backup_wal_files
            ;;
        *)
            log "ERROR: Invalid backup type. Use: full, incremental, wal, or all"
            exit 1
            ;;
    esac
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Send notification
    if [ "$success" = true ]; then
        send_notification "SUCCESS" "Backup completed successfully: $backup_type"
        log "Backup process completed successfully"
        exit 0
    else
        send_notification "FAILED" "Backup failed: $backup_type"
        log "Backup process failed"
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    local deps=("pg_dump" "pg_restore" "createdb" "dropdb")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log "ERROR: Required dependency not found: $dep"
            exit 1
        fi
    done
}

# Script execution
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    check_dependencies
    main "$@"
fi