import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Snapshot } from './Snapshot';
import { BondProvider } from './BondProvider';

@Entity()
export class Node {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'integer' })
    block_number!: number;

    @Column({ type: 'text' })
    node_address!: string;

    @Column({ type: 'numeric' })
    total_bond!: number;

    @Column({ type: 'numeric' })
    earnings!: number;

    @Column({ type: 'text' })
    status!: string;

    @ManyToOne(() => Snapshot, (snapshot: Snapshot) => snapshot.nodes)
    snapshot!: Snapshot;

    @OneToMany(() => BondProvider, (bondProvider: BondProvider) => bondProvider.node)
    bond_providers!: BondProvider[];
} 