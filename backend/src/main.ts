import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { AppModule } from './app.module';
import { join } from 'path';
import * as fs from 'fs';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const uploadsPath = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath))
    fs.mkdirSync(uploadsPath, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://192.168.10.156:3100',
      credentials: true,
    },
  });

  app.setGlobalPrefix('api', {
    exclude: ['webhooks/whatsapp', 'webhooks/waha'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useStaticAssets(uploadsPath, { prefix: '/uploads' });

  // ============================================================
  // STARTUP: Reset de agentes que podem estar com status fantasma
  // ============================================================
  const prisma = app.get(PrismaService);
  const reset = await prisma.user.updateMany({
    where: { onlineStatus: { in: ['ONLINE', 'BUSY'] } },
    data: { onlineStatus: 'OFFLINE', lastHeartbeatAt: null },
  });
  if (reset.count > 0) {
    Logger.log(
      `[STARTUP] ${reset.count} agente(s) resetados para OFFLINE`,
      'Bootstrap',
    );
  }

  const port = process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  Logger.log(`Backend rodando em http://192.168.10.156:${port}`, 'Bootstrap');
  Logger.log(
    `API disponivel em http://192.168.10.156:${port}/api`,
    'Bootstrap',
  );
}
bootstrap();
