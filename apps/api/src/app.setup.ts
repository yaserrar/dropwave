import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerErrorInterceptor } from 'nestjs-pino';

/** What main.ts sets up on the app, shared with the e2e tests. */
export function configureApp(app: INestApplication) {
  // Passes thrown errors to the request log, so a 4xx line says why it failed.
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.setGlobalPrefix('api');
  // In production the web app and the API share an origin. Locally they don't, and
  // the share page sends its unlock cookie, which needs an explicit origin.
  app.enableCors({
    origin: app
      .get(ConfigService)
      .getOrThrow<string>('APP_URL')
      .replace(/\/+$/, ''),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
}
