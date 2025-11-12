import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('emails')
export class Email {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  to: string;

  @Column()
  subject: string;

  @Column('text')
  text: string;

  @Column('text', { nullable: true })
  html: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'sent' | 'failed';

  @CreateDateColumn()
  created_at: Date;
}