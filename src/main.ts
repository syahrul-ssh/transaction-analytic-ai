import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './utils/all-exception.filter';
import { validationExceptionFactory } from './utils/factory/validation-exception.factory';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useLogger(app.get(Logger));

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.useGlobalFilters(
    new GlobalExceptionFilter(),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 3000;

  await app.listen(port);

  app.get(Logger).log(`Application is running on port: ${port}`);
}
bootstrap();
