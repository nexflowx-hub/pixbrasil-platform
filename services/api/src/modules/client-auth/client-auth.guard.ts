import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { ClientAuthService } from "./client-auth.service";
import type { ClientRequest } from "./client-auth.types";

@Injectable()
export class ClientAuthGuard implements CanActivate {
  constructor(private readonly auth: ClientAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ClientRequest>();
    const authorization = Array.isArray(request.headers.authorization)
      ? request.headers.authorization[0]
      : request.headers.authorization;
    request.clientContext = await this.auth.authenticate(authorization);
    return true;
  }
}
