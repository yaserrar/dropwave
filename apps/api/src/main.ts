import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  // Hold startup logs until pino is ready, so every line uses the same format.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
