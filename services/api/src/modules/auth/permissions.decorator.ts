import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSIONS_KEY = "pixbrasil.requiredPermissions";

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
