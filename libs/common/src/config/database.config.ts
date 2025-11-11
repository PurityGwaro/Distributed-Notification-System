import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.USER_DB_HOST || 'localhost',
    port: parseInt(process.env.USER_DB_PORT || '5432', 10),
    username: process.env.USER_DB_USERNAME || 'postgres',
    password: process.env.USER_DB_PASSWORD || 'postgres',
    database: process.env.USER_DB_NAME || 'user_service',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: true,
    autoLoadEntities: true,
  }),
);
