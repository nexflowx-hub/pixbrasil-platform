-- Fix mutable search_path on backend-only financial functions.
-- Functions remain non-executable by anon/authenticated roles.

alter function pixbrasil.ensure_brl_financial_accounts(uuid)
  set search_path = pg_catalog, public, pixbrasil, controlplane;

alter function pixbrasil.post_verified_pix_settlement(uuid)
  set search_path = pg_catalog, public, pixbrasil, controlplane;

alter function pixbrasil.release_due_settlements(integer)
  set search_path = pg_catalog, public, pixbrasil, controlplane;

alter function controlplane.create_manual_payout_ticket(uuid,uuid,numeric,text,text)
  set search_path = pg_catalog, public, pixbrasil, controlplane;

alter function controlplane.cancel_manual_payout_ticket(uuid,uuid)
  set search_path = pg_catalog, public, pixbrasil, controlplane;

alter function controlplane.reject_manual_payout(uuid,uuid,text)
  set search_path = pg_catalog, public, pixbrasil, controlplane;

alter function controlplane.mark_manual_payout_paid(uuid,uuid,text)
  set search_path = pg_catalog, public, pixbrasil, controlplane;

alter function controlplane.confirm_manual_payout(uuid,uuid)
  set search_path = pg_catalog, public, pixbrasil, controlplane;
