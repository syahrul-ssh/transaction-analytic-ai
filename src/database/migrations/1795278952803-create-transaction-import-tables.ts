import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTransactionImportTables1795278952803 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        CREATE TABLE "import_batches" (
            "id" uuid NOT NULL,
            "original_filename" varchar(255) NOT NULL,
            "storage_filename" varchar(255) NOT NULL,
            "file_path" text NOT NULL,
            "file_size" bigint NOT NULL,
            "status" varchar(30) NOT NULL DEFAULT 'UPLOADED',
            "total_rows" integer NOT NULL DEFAULT 0,
            "processed_rows" integer NOT NULL DEFAULT 0,
            "successful_rows" integer NOT NULL DEFAULT 0,
            "failed_rows" integer NOT NULL DEFAULT 0,
            "duplicate_rows" integer NOT NULL DEFAULT 0,
            "started_at" timestamptz,
            "completed_at" timestamptz,
            "error_message" text,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_import_batches" PRIMARY KEY ("id")
        )
        `);

        await queryRunner.query(`
        CREATE INDEX "IDX_import_batches_status"
        ON "import_batches" ("status")
        `);

        await queryRunner.query(`
        CREATE TABLE "transactions" (
            "id" uuid NOT NULL,
            "external_transaction_id" varchar(255) NOT NULL,
            "import_batch_id" uuid NOT NULL,
            "transaction_date" date NOT NULL,
            "amount" numeric(20,4) NOT NULL,
            "currency" varchar(3) NOT NULL,
            "transaction_type" varchar(20) NOT NULL,
            "merchant" varchar(255),
            "category" varchar(255),
            "description" text,
            "raw_data" jsonb NOT NULL,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            "updated_at" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_transactions" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_transactions_external_transaction_id"
            UNIQUE ("external_transaction_id"),
            CONSTRAINT "FK_transactions_import_batch"
            FOREIGN KEY ("import_batch_id")
            REFERENCES "import_batches" ("id")
            ON DELETE RESTRICT
        )
        `);

        await queryRunner.query(`
        CREATE INDEX "IDX_transactions_transaction_date"
        ON "transactions" ("transaction_date")
        `);

        await queryRunner.query(`
        CREATE INDEX "IDX_transactions_category"
        ON "transactions" ("category")
        `);

        await queryRunner.query(`
        CREATE INDEX "IDX_transactions_merchant"
        ON "transactions" ("merchant")
        `);

        await queryRunner.query(`
        CREATE TABLE "import_errors" (
            "id" uuid NOT NULL,
            "import_batch_id" uuid NOT NULL,
            "row_number" integer NOT NULL,
            "raw_data" jsonb NOT NULL,
            "error_code" varchar(100) NOT NULL,
            "error_message" text NOT NULL,
            "created_at" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_import_errors" PRIMARY KEY ("id"),
            CONSTRAINT "FK_import_errors_import_batch"
            FOREIGN KEY ("import_batch_id")
            REFERENCES "import_batches" ("id")
            ON DELETE CASCADE
        )
        `);

        await queryRunner.query(`
        CREATE INDEX "IDX_import_errors_batch_id"
        ON "import_errors" ("import_batch_id")
        `);

        await queryRunner.query(`
        CREATE UNIQUE INDEX "UQ_import_errors_batch_row"
        ON "import_errors" ("import_batch_id", "row_number")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "UQ_import_errors_batch_row"`);
        await queryRunner.query(`DROP INDEX "IDX_import_errors_batch_id"`);
        await queryRunner.query(`DROP TABLE "import_errors"`);
        await queryRunner.query(`DROP INDEX "IDX_transactions_merchant"`);
        await queryRunner.query(`DROP INDEX "IDX_transactions_category"`);
        await queryRunner.query(`DROP INDEX "IDX_transactions_transaction_date"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP INDEX "IDX_import_batches_status"`);
        await queryRunner.query(`DROP TABLE "import_batches"`);
    }

}
