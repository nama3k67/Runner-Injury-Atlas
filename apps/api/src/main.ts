import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { type AppConfig, CONFIG } from './config';

const app = await NestFactory.create(AppModule);
const config = app.get<AppConfig>(CONFIG);
app.setGlobalPrefix('api');
app.enableCors({ origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()) });
app.enableShutdownHooks();
await app.listen(config.PORT);
console.log(`atlas api listening on http://localhost:${config.PORT}/api`);
