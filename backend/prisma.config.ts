import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// .env는 레포 루트 하나만 쓴다
config({ path: '../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
