import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Session } from './session.entity';
import { EventType } from './event-type.entity';

@Entity('UserEvent')
export class UserEvent {
  @PrimaryGeneratedColumn()
  event_id: number;

  @Column({ type: 'datetime' })
  event_ts: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  page_path: string | null;

  @Column({ type: 'json', nullable: true })
  event_data: Record<string, any> | null;

  @Column({ type: 'varchar', length: 36 })
  session_id_Session: string;

  @Column({ type: 'varchar', length: 50 })
  code_EventType: string;

  @ManyToOne(() => Session, (session) => session.userEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id_Session' })
  session: Session;

  @ManyToOne(() => EventType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'code_EventType' })
  eventType: EventType;
}

