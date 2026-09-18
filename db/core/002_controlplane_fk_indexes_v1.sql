-- Applied after controlplane_admin_core_v1.
-- Cover operational foreign keys before the Admin Control Plane starts querying them.

CREATE INDEX IF NOT EXISTS admin_user_roles_granted_by_idx
  ON controlplane.admin_user_roles(granted_by) WHERE granted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS feature_flags_updated_by_idx
  ON controlplane.feature_flags(updated_by) WHERE updated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS manual_adjustments_adjustment_ledger_tx_idx
  ON controlplane.manual_adjustment_requests(adjustment_ledger_transaction_id)
  WHERE adjustment_ledger_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS manual_adjustments_asset_idx
  ON controlplane.manual_adjustment_requests(asset_id);
CREATE INDEX IF NOT EXISTS manual_adjustments_original_ledger_tx_idx
  ON controlplane.manual_adjustment_requests(original_ledger_transaction_id)
  WHERE original_ledger_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS manual_adjustments_requested_by_idx
  ON controlplane.manual_adjustment_requests(requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS manual_adjustments_wallet_idx
  ON controlplane.manual_adjustment_requests(wallet_id) WHERE wallet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payout_requests_asset_idx
  ON controlplane.payout_requests(asset_id);
CREATE INDEX IF NOT EXISTS payout_requests_requested_by_idx
  ON controlplane.payout_requests(requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS payout_requests_wallet_idx
  ON controlplane.payout_requests(wallet_id) WHERE wallet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS provider_credential_versions_created_by_idx
  ON controlplane.provider_credential_versions(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS provider_credential_versions_rotated_from_idx
  ON controlplane.provider_credential_versions(rotated_from_id) WHERE rotated_from_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS system_settings_updated_by_idx
  ON controlplane.system_settings(updated_by) WHERE updated_by IS NOT NULL;
