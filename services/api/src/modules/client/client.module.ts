import { Module } from "@nestjs/common";
import { ClientAuthModule } from "../client-auth/client-auth.module";
import { ClientController } from "./client.controller";
import { ClientService } from "./client.service";

@Module({
  imports: [ClientAuthModule],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
