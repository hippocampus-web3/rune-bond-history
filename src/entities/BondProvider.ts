import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Node } from './Node';

@Entity()
export class BondProvider {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'integer' })
    block_number!: number;

    @Column({ type: 'text' })
    node_address!: string;

    @Column({ type: 'text' })
    bond_provider_address!: string;

    @Column({ type: 'numeric' })
    bond_amount!: number;

    @ManyToOne(() => Node, (node: Node) => node.bond_providers)
    node!: Node;
} 