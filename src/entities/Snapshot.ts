import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Node } from './Node';

@Entity()
export class Snapshot {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'integer', unique: true })
    block_number!: number;

    @Column({ type: 'timestamp with time zone' })
    block_timestamp!: Date;

    @Column({ type: 'numeric' })
    total_active_bond!: number;

    @Column({ type: 'numeric', nullable: true })
    total_earnings!: number;

    @OneToMany(() => Node, (node: Node) => node.snapshot)
    nodes!: Node[];
} 