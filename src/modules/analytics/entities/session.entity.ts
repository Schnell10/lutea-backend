import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { UserEvent } from './user-event.entity';

@Entity('Session')
export class Session {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  session_id: string;

  @Column({ type: 'datetime' })
  started_at: Date;

  @Column({ type: 'datetime', nullable: true })
  ended_at: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  browser: string | null;

  @Column({ 
    type: 'enum', 
    enum: ['mobile', 'desktop', 'tablet'],
    nullable: true 
  })
  device_type: 'mobile' | 'desktop' | 'tablet' | null;

  @Column({ type: 'boolean', default: false })
  is_login: boolean;

  @OneToMany(() => UserEvent, (userEvent) => userEvent.session)
  userEvents: UserEvent[];
}