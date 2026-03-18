import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create transactions table
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "provider_name" character varying(50) NOT NULL,
        "provider_transaction_id" character varying(255),
        "type" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "failure_reason" text,
        CONSTRAINT "PK_transactions" PRIMARY KEY ("id")
      )
    `);

    // Create provider_configs table
    await queryRunner.query(`
      CREATE TABLE "provider_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(50) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 0,
        "credentials_encrypted" text NOT NULL,
        "settings" jsonb NOT NULL DEFAULT '{}',
        "health_check_url" character varying(500),
        "webhook_url" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_provider_configs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_provider_configs_name" UNIQUE ("name")
      )
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "transaction_id" uuid,
        "action" character varying(50) NOT NULL,
        "provider_name" character varying(50),
        "request_data" jsonb,
        "response_data" jsonb,
        "error_data" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Create provider_health table
    await queryRunner.query(`
      CREATE TABLE "provider_health" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "provider_name" character varying(50) NOT NULL,
        "status" character varying NOT NULL,
        "response_time_ms" integer,
        "error_rate" numeric(5,2),
        "last_check" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_provider_health" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for transactions
    await queryRunner.query(`CREATE INDEX "IDX_transactions_organization_id" ON "transactions" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_organization_created" ON "transactions" ("organization_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_provider_status" ON "transactions" ("provider_name", "status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transactions_provider_transaction_id" ON "transactions" ("provider_transaction_id") WHERE "provider_transaction_id" IS NOT NULL`);

    // Create indexes for provider_configs
    await queryRunner.query(`CREATE INDEX "IDX_provider_configs_active_priority" ON "provider_configs" ("is_active", "priority")`);

    // Create indexes for audit_logs
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_transaction_created" ON "audit_logs" ("transaction_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action_created" ON "audit_logs" ("action", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_provider_created" ON "audit_logs" ("provider_name", "created_at")`);

    // Create indexes for provider_health
    await queryRunner.query(`CREATE INDEX "IDX_provider_health_provider_created" ON "provider_health" ("provider_name", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_provider_health_status_created" ON "provider_health" ("status", "created_at")`);

    // Add foreign key constraint for audit_logs
    await queryRunner.query(`
      ALTER TABLE "audit_logs" 
      ADD CONSTRAINT "FK_audit_logs_transaction" 
      FOREIGN KEY ("transaction_id") 
      REFERENCES "transactions"("id") 
      ON DELETE CASCADE
    `);

    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "transaction_type_enum" AS ENUM ('payment', 'refund', 'subscription')
    `);
    
    await queryRunner.query(`
      CREATE TYPE "transaction_status_enum" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')
    `);
    
    await queryRunner.query(`
      CREATE TYPE "provider_health_status_enum" AS ENUM ('healthy', 'degraded', 'unhealthy')
    `);

    // Update columns to use enum types
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "transaction_type_enum" USING "type"::"transaction_type_enum"`);
    await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "transaction_status_enum" USING "status"::"transaction_status_enum"`);
    await queryRunner.query(`ALTER TABLE "provider_health" ALTER COLUMN "status" TYPE "provider_health_status_enum" USING "status"::"provider_health_status_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_transaction"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_provider_health_status_created"`);
    await queryRunner.query(`DROP INDEX "IDX_provider_health_provider_created"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_provider_created"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_action_created"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_transaction_created"`);
    await queryRunner.query(`DROP INDEX "IDX_provider_configs_active_priority"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_provider_transaction_id"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_provider_status"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_organization_created"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_organization_id"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "provider_health"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "provider_configs"`);
    await queryRunner.query(`DROP TABLE "transactions"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "provider_health_status_enum"`);
    await queryRunner.query(`DROP TYPE "transaction_status_enum"`);
    await queryRunner.query(`DROP TYPE "transaction_type_enum"`);
  }
}