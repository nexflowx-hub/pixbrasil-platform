import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { AdminAuthService } from "./admin-auth.service";
import type { AdminRequest } from "./admin-auth.types";

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    request.adminContext = await this.auth.authenticate(
      request.headers.authorization,
    );
    return true;
  }
}
