import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTotalEarningsToSnapshot1714132800001 implements MigrationInterface {
    name = 'AddTotalEarningsToSnapshot1714132800001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "snapshot" ADD COLUMN "total_earnings" numeric`);
        
        // Calcular y actualizar total_earnings para snapshots existentes (solo nodos activos)
        await queryRunner.query(`
            UPDATE snapshot s
            SET total_earnings = (
                SELECT COALESCE(SUM(n.earnings), 0)
                FROM node n
                WHERE n."snapshotId" = s.id
                AND n.status = 'Active'
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "snapshot" DROP COLUMN "total_earnings"`);
    }
} 