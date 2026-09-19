import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { assertRuntimeConfiguration } from "./config/runtime-env";

async function bootstrap() {
  assertRuntimeConfiguration();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const adminOrigins = (
    process.env.ADMIN_ORIGINS ??
    "https://admin.pixbrasil.org,http://localhost:3010"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.set("trust proxy", 1);
  app.enableCors({
    origin: adminOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Accept"],
    credentials: false,
    maxAge: 600,
  });
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
