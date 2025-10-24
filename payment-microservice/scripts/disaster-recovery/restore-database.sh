#!/bin/bash

# Payment Service Database Restore Script
# This script restores the payment service database from backups

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/payment-service}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-payment_service}"
DB_USER="${DB_USER:-payment_user}"
S3_BUCKET="${S3_BUCKET:-payment-service-backups}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to list available backups
list_backups() {
    log "Available local backups:"
    
    echo "Full backups:"
    find "$BACKUP_DIR/full" -name "*.sql" -type f -exec basename {} \; 2>/dev/null | sort -r | head -10
    
    echo ""
    echo "Incremental backups:"
    find "$BACKUP_DIR/incremental" -name "*.sql" -type f -exec basename {} \; 2>/dev/null | sort -r | head -10
    
    # List S3 backups if AWS CLI is available
    if command -v aws &> /dev/null; then
        echo ""
        echo "S3 backups:"
        aws s3 ls "s3://$S3_BUCKET/full/" | tail -10
    fi
}

# Function to download backup from S3
download_backup() {
    local backup_name="$1"
    local backup_type="${2:-full}"
    
    log "Downloading backup from S3: $backup_name"
    
    local local_path="$BACKUP_DIR/$backup_type/$backup_name"
    
    if aws s3 cp "s3://$S3_BUCKET/$backup_type/$backup_name" "$local_path"; then
        log "Backup downloaded successfully: $local_path"
        echo "$local_path"
    else
        log "ERROR: Failed to download backup from S3"
        return 1
    fi
}

# Function to verify backup before restore
verify_backup_file() {
    local backup_file="$1"
    
    log "Verifying backup file: $backup_file"
    
    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        log "ERROR: Backup file not found: $backup_file"
        return 1
    fi
    
    # Check if file is not empty
    if [ ! -s "$backup_file" ]; then
        log "ERROR: Backup file is empty: $backup_file"
        return 1
    fi
    
    # Verify checksum if available
    if [ -f "$backup_file.sha256" ]; then
        if sha256sum -c "$backup_file.sha256"; then
            log "Backup file integrity verified"
        else
            log "ERROR: Backup file integrity check failed"
            return 1
        fi
    fi
    
    # Test if it's a valid PostgreSQL backup
    if file "$backup_file" | grep -q "PostgreSQL custom database dump"; then
        log "Backup file format verified"
        return 0
    else
        log "ERROR: Invalid backup file format"
        return 1
    fi
}

# Function to create database backup before restore
create_pre_restore_backup() {
    log "Creating pre-restore backup..."
    
    local pre_restore_backup="$BACKUP_DIR/pre-restore/pre_restore_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p "$(dirname "$pre_restore_backup")"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --format=custom --compress=9 --file="$pre_restore_backup"; then
        log "Pre-restore backup created: $pre_restore_backup"
        return 0
    else
        log "WARNING: Failed to create pre-restore backup"
        return 1
    fi
}

# Function to stop application services
stop_services() {
    log "Stopping application services..."
    
    # Stop Kubernetes deployment
    if command -v kubectl &> /dev/null; then
        kubectl scale deployment payment-service --replicas=0 2>/dev/null || true
        kubectl scale deployment payment-service-worker --replicas=0 2>/dev/null || true
        
        # Wait for pods to terminate
        sleep 30
        log "Kubernetes services stopped"
    fi
    
    # Stop Docker containers
    if command -v docker &> /dev/null; then
        docker stop payment-service 2>/dev/null || true
        docker stop payment-worker 2>/dev/null || true
        log "Docker services stopped"
    fi
}

# Function to start application services
start_services() {
    log "Starting application services..."
    
    # Start Kubernetes deployment
    if command -v kubectl &> /dev/null; then
        kubectl scale deployment payment-service --replicas=3 2>/dev/null || true
        kubectl scale deployment payment-service-worker --replicas=2 2>/dev/null || true
        
        # Wait for pods to be ready
        kubectl wait --for=condition=ready pod -l app=payment-service --timeout=300s 2>/dev/null || true
        log "Kubernetes services started"
    fi
    
    # Start Docker containers
    if command -v docker &> /dev/null; then
        docker start payment-service 2>/dev/null || true
        docker start payment-worker 2>/dev/null || true
        log "Docker services started"
    fi
}

# Function to restore from full backup
restore_full_backup() {
    local backup_file="$1"
    local drop_existing="${2:-false}"
    
    log "Starting full database restore from: $backup_file"
    
    # Verify backup file
    if ! verify_backup_file "$backup_file"; then
        return 1
    fi
    
    # Create pre-restore backup
    create_pre_restore_backup || true
    
    # Stop services
    stop_services
    
    # Drop existing database if requested
    if [ "$drop_existing" = "true" ]; then
        log "Dropping existing database..."
        dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
        createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    else
        # Clean existing data
        log "Cleaning existing database..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            TRUNCATE TABLE transactions CASCADE;
            TRUNCATE TABLE provider_configs CASCADE;
            TRUNCATE TABLE audit_logs CASCADE;
            TRUNCATE TABLE provider_health CASCADE;
        " 2>/dev/null || true
    fi
    
    # Restore database
    log "Restoring database..."
    if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --verbose --clean --if-exists "$backup_file"; then
        log "Database restore completed successfully"
        
        # Verify restore
        verify_restore
        
        # Start services
        start_services
        
        return 0
    else
        log "ERROR: Database restore failed"
        return 1
    fi
}

# Function to restore incremental backups
restore_incremental_backups() {
    local base_backup="$1"
    local incremental_dir="$BACKUP_DIR/incremental"
    
    log "Starting incremental restore..."
    
    # First restore the base backup
    if ! restore_full_backup "$base_backup"; then
        return 1
    fi
    
    # Find and apply incremental backups in chronological order
    find "$incremental_dir" -name "*.sql" -type f | sort | while read -r inc_backup; do
        log "Applying incremental backup: $(basename "$inc_backup")"
        
        if pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --verbose --data-only "$inc_backup"; then
            log "Incremental backup applied: $(basename "$inc_backup")"
        else
            log "ERROR: Failed to apply incremental backup: $(basename "$inc_backup")"
            return 1
        fi
    done
    
    log "Incremental restore completed"
}

# Function to perform point-in-time recovery
point_in_time_recovery() {
    local backup_file="$1"
    local recovery_time="$2"
    local wal_dir="$BACKUP_DIR/wal"
    
    log "Starting point-in-time recovery to: $recovery_time"
    
    # Restore base backup
    if ! restore_full_backup "$backup_file" "true"; then
        return 1
    fi
    
    # Apply WAL files up to recovery point
    log "Applying WAL files up to recovery point..."
    
    # Create recovery configuration
    local recovery_conf="/tmp/recovery.conf"
    cat > "$recovery_conf" << EOF
restore_command = 'cp $wal_dir/%f %p'
recovery_target_time = '$recovery_time'
recovery_target_action = 'promote'
EOF
    
    # Stop PostgreSQL
    sudo systemctl stop postgresql 2>/dev/null || true
    
    # Copy recovery configuration
    sudo cp "$recovery_conf" "/var/lib/postgresql/data/recovery.conf"
    
    # Start PostgreSQL in recovery mode
    sudo systemctl start postgresql
    
    # Wait for recovery to complete
    log "Waiting for recovery to complete..."
    while [ -f "/var/lib/postgresql/data/recovery.conf" ]; do
        sleep 5
    done
    
    log "Point-in-time recovery completed"
    
    # Start services
    start_services
}

# Function to verify restore
verify_restore() {
    log "Verifying database restore..."
    
    # Check if database is accessible
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        log "ERROR: Database is not accessible after restore"
        return 1
    fi
    
    # Check table counts
    local table_counts
    table_counts=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT 
            'transactions: ' || COUNT(*) FROM transactions
        UNION ALL
        SELECT 
            'provider_configs: ' || COUNT(*) FROM provider_configs
        UNION ALL
        SELECT 
            'audit_logs: ' || COUNT(*) FROM audit_logs;
    ")
    
    log "Table counts after restore:"
    echo "$table_counts"
    
    # Check data integrity
    local integrity_check
    integrity_check=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM transactions WHERE amount IS NULL OR amount < 0;
    ")
    
    if [ "$integrity_check" -eq 0 ]; then
        log "Data integrity check passed"
        return 0
    else
        log "ERROR: Data integrity issues found: $integrity_check invalid records"
        return 1
    fi
}

# Function to rollback restore
rollback_restore() {
    log "Rolling back restore..."
    
    local pre_restore_backup
    pre_restore_backup=$(find "$BACKUP_DIR/pre-restore" -name "*.sql" -type f | sort -r | head -1)
    
    if [ -n "$pre_restore_backup" ]; then
        log "Rolling back to pre-restore backup: $pre_restore_backup"
        restore_full_backup "$pre_restore_backup" "true"
    else
        log "ERROR: No pre-restore backup found for rollback"
        return 1
    fi
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
}

# Interactive restore function
interactive_restore() {
    echo "=== Payment Service Database Restore ==="
    echo ""
    
    list_backups
    
    echo ""
    read -p "Enter backup filename (or 'download' to get from S3): " backup_input
    
    if [ "$backup_input" = "download" ]; then
        read -p "Enter S3 backup filename: " s3_backup
        backup_file=$(download_backup "$s3_backup")
    else
        backup_file="$BACKUP_DIR/full/$backup_input"
    fi
    
    echo ""
    echo "Restore options:"
    echo "1. Full restore (replace all data)"
    echo "2. Incremental restore (apply incremental backups)"
    echo "3. Point-in-time recovery"
    echo ""
    read -p "Select restore type (1-3): " restore_type
    
    case "$restore_type" in
        1)
            read -p "Drop existing database? (y/N): " drop_db
            if [ "$drop_db" = "y" ] || [ "$drop_db" = "Y" ]; then
                restore_full_backup "$backup_file" "true"
            else
                restore_full_backup "$backup_file" "false"
            fi
            ;;
        2)
            restore_incremental_backups "$backup_file"
            ;;
        3)
            read -p "Enter recovery time (YYYY-MM-DD HH:MM:SS): " recovery_time
            point_in_time_recovery "$backup_file" "$recovery_time"
            ;;
        *)
            log "ERROR: Invalid restore type selected"
            exit 1
            ;;
    esac
}

# Main execution
main() {
    local command="$1"
    
    case "$command" in
        "list")
            list_backups
            ;;
        "full")
            local backup_file="$2"
            local drop_existing="${3:-false}"
            restore_full_backup "$backup_file" "$drop_existing"
            ;;
        "incremental")
            local base_backup="$2"
            restore_incremental_backups "$base_backup"
            ;;
        "pitr")
            local backup_file="$2"
            local recovery_time="$3"
            point_in_time_recovery "$backup_file" "$recovery_time"
            ;;
        "verify")
            verify_restore
            ;;
        "rollback")
            rollback_restore
            ;;
        "interactive"|"")
            interactive_restore
            ;;
        *)
            echo "Usage: $0 {list|full|incremental|pitr|verify|rollback|interactive}"
            echo ""
            echo "Commands:"
            echo "  list                          - List available backups"
            echo "  full <backup_file> [drop]     - Restore from full backup"
            echo "  incremental <base_backup>     - Restore with incremental backups"
            echo "  pitr <backup_file> <time>     - Point-in-time recovery"
            echo "  verify                        - Verify current database"
            echo "  rollback                      - Rollback to pre-restore backup"
            echo "  interactive                   - Interactive restore mode"
            exit 1
            ;;
    esac
}

# Check dependencies
check_dependencies() {
    local deps=("pg_dump" "pg_restore" "psql" "createdb" "dropdb")
    
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