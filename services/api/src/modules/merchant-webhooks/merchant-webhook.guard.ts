import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { MerchantAuthService } from "../merchant-auth/merchant-auth.service";
import type { MerchantApiRequest } from "../merchant-auth/merchant-auth.types";

@Injectable()
export class MerchantWebhookGuard implements CanActivate {
  constructor(private readonly auth: MerchantAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MerchantApiRequest>();
    request.merchantContext = await this.auth.authenticate(
      request.headers,
      "webhooks:manage",
    );
    return true;
  }
}
