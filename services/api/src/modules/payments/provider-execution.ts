import type {
  PixCreateChargeInput,
  PixProviderAdapter,
  ProviderCreateOutcome,
  ProviderRecoveryOutcome,
} from "../providers/provider-adapter";

export type ProviderExecutionResult =
  | {
      kind: "CREATED";
      providerPaymentId: string;
      payload: unknown;
      recovered: boolean;
    }
  | {
      kind: "FINAL_REJECTION";
      code?: string;
      message?: string;
    }
  | {
      kind: "SAFE_FAILOVER_ALLOWED";
      reason: string;
    }
  | {
      kind: "RECONCILIATION_REQUIRED";
      reason: string;
    };

function mapCreateOutcome(outcome: ProviderCreateOutcome): ProviderExecutionResult {
  if (outcome.kind === "CREATED") {
    return {
      kind: "CREATED",
      providerPaymentId: outcome.providerPaymentId,
      payload: outcome.payload,
      recovered: false,
    };
  }

  if (outcome.kind === "REJECTED") {
    return {
      kind: "FINAL_REJECTION",
      code: outcome.code,
      message: outcome.message,
    };
  }

  if (outcome.kind === "UNAVAILABLE") {
    return {
      kind: "SAFE_FAILOVER_ALLOWED",
      reason: outcome.message ?? "PROVIDER_UNAVAILABLE_BEFORE_CREATE",
    };
  }

  return {
    kind: "RECONCILIATION_REQUIRED",
    reason: outcome.message ?? "AMBIGUOUS_PROVIDER_CREATE",
  };
}

function mapRecoveryOutcome(
  outcome: ProviderRecoveryOutcome,
): ProviderExecutionResult {
  if (outcome.kind === "FOUND") {
    return {
      kind: "CREATED",
      providerPaymentId: outcome.providerPaymentId,
      payload: outcome.payload,
      recovered: true,
    };
  }

  if (outcome.kind === "NOT_FOUND") {
    return {
      kind: "SAFE_FAILOVER_ALLOWED",
      reason: "RECOVERY_CONFIRMED_NOT_FOUND",
    };
  }

  return {
    kind: "RECONCILIATION_REQUIRED",
    reason: outcome.message ?? "RECOVERY_STATE_UNKNOWN",
  };
}

/**
 * Executes exactly one provider attempt.
 *
 * This function deliberately does not choose the next provider. Its output
 * tells the orchestration layer whether a second provider may be attempted.
 *
 * AMBIGUOUS create outcomes never become blind failover. Recovery must first
 * prove FOUND or NOT_FOUND. If recovery is unsupported/unknown, the payment
 * remains in reconciliation.
 */
export async function executeProviderAttempt(params: {
  adapter: PixProviderAdapter;
  input: PixCreateChargeInput;
  credentials: unknown;
  recoveryReference: string;
}): Promise<ProviderExecutionResult> {
  const { adapter, input, credentials, recoveryReference } = params;

  const created = await adapter.createCharge(input, credentials);

  if (created.kind !== "AMBIGUOUS") {
    return mapCreateOutcome(created);
  }

  if (!adapter.capabilities.supportsRecoveryByExternalId) {
    return {
      kind: "RECONCILIATION_REQUIRED",
      reason:
        created.message ??
        "AMBIGUOUS_CREATE_WITHOUT_CONFIRMED_RECOVERY_CAPABILITY",
    };
  }

  const recovered = await adapter.recoverCreate(
    recoveryReference,
    credentials,
  );

  return mapRecoveryOutcome(recovered);
}
