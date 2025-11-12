import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('emails')
export class Email {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, unique: true })
  @Index()
  request_id: string;

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

  @Column({ type: 'text', nullable: true })
  template_code: string;

  @Column({ type: 'json', nullable: true })
  template_variables: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  correlation_id: string;

  @CreateDateColumn()
  created_at: Date;
}
