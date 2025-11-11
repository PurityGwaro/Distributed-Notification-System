import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Template } from './template/template.entity';
import { TemplateModule } from './template/template.module';
import { HealthModule } from './health/heath.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'postgres',
      port: +process.env.DB_PORT || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'templates_db',
      entities: [Template],
      synchronize: true, // set to true development only.
    }),
    TemplateModule,
    HealthModule
  ],
})
export class AppModule {}
