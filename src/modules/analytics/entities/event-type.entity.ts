import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { UserEvent } from './user-event.entity.js';

@Entity('EventType')
export class EventType {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'varchar', length: 20 })
  category: string;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  @OneToMany(() => UserEvent, (userEvent) => userEvent.eventType)
  userEvents: UserEvent[];
}

