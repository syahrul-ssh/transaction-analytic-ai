import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTransactionAnalysesTables1795286771762 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "transaction_analyses" (
                "id" uuid NOT NULL,
                "analysis_type" text NOT NULL,
                "status" text NOT NULL DEFAULT 'PENDING',
                "parameters" jsonb,
                "dataset_summary" jsonb,
                "result" jsonb,
                "prompt_version" text,
                "model" text,
                "error_message" text,
                "retry_count" integer NOT NULL DEFAULT 0,
                "started_at" timestamptz,
                "completed_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_transaction_analyses_id" PRIMARY KEY ("id")
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "transaction_analyses";
        `);
    }

}
