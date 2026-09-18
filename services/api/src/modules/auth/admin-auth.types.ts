export type AuthenticatorAssuranceLevel = "aal1" | "aal2";

export interface AdminContext {
  authUserId: string;
  adminUserId: string;
  email?: string;
  displayName?: string;
  aal: AuthenticatorAssuranceLevel;
  roles: string[];
  permissions: string[];
}

export interface AdminRequest {
  headers: {
    authorization?: string;
  };
  adminContext?: AdminContext;
}
