import { Module } from "@nestjs/common";
import { ClientAuthModule } from "../client-auth/client-auth.module";
import { FinanceModule } from "../finance/finance.module";
import { ClientController } from "./client.controller";
import { ClientService } from "./client.service";

@Module({
  imports: [ClientAuthModule, FinanceModule],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
