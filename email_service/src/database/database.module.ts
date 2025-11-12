import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [Notification],
      synchronize: true, // Auto-create tables in dev mode
    }),
    TypeOrmModule.forFeature([Notification]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
