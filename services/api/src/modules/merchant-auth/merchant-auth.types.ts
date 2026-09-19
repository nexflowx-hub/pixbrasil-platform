export interface MerchantApiContext {
  apiKeyId: string;
  merchantId: string;
  accountId: string;
  merchantCode?: string;
  scopes: string[];
  allowedStoreIds: string[];
}

export interface MerchantApiRequest {
  headers: Record<string, string | string[] | undefined>;
  merchantContext?: MerchantApiContext;
}
