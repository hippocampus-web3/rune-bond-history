import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1714132800000 implements MigrationInterface {
    name = 'InitialSchema1714132800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "snapshot" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "block_number" integer NOT NULL, "block_timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "total_active_bond" numeric NOT NULL, CONSTRAINT "UQ_snapshot_block_number" UNIQUE ("block_number"), CONSTRAINT "PK_snapshot" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "node" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "block_number" integer NOT NULL, "node_address" text NOT NULL, "total_bond" numeric NOT NULL, "earnings" numeric NOT NULL, "status" text NOT NULL, "snapshotId" uuid, CONSTRAINT "PK_node" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bond_provider" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "block_number" integer NOT NULL, "node_address" text NOT NULL, "bond_provider_address" text NOT NULL, "bond_amount" numeric NOT NULL, "nodeId" uuid, CONSTRAINT "PK_bond_provider" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "node" ADD CONSTRAINT "FK_node_snapshot" FOREIGN KEY ("snapshotId") REFERENCES "snapshot"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bond_provider" ADD CONSTRAINT "FK_bond_provider_node" FOREIGN KEY ("nodeId") REFERENCES "node"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bond_provider" DROP CONSTRAINT "FK_bond_provider_node"`);
        await queryRunner.query(`ALTER TABLE "node" DROP CONSTRAINT "FK_node_snapshot"`);
        await queryRunner.query(`DROP TABLE "bond_provider"`);
        await queryRunner.query(`DROP TABLE "node"`);
        await queryRunner.query(`DROP TABLE "snapshot"`);
    }
} 