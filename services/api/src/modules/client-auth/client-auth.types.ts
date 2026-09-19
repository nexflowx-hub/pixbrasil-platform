export interface ClientAccountAccess {
  accountId: string;
  accountType: "INDIVIDUAL" | "BUSINESS" | "INTERNAL";
  accountStatus: string;
  kycStatus: string;
  role: "OWNER" | "ADMIN" | "FINANCE" | "VIEWER";
  baseCurrency: string;
}

export interface ClientContext {
  authUserId: string;
  userId: string;
  email?: string;
  userStatus: string;
  aal: string;
  accounts: ClientAccountAccess[];
}

export interface ClientRequest {
  headers: Record<string, string | string[] | undefined>;
  clientContext?: ClientContext;
}
