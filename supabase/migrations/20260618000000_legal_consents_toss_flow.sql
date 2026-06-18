-- Allow 'toss' legal-consent flow for Apps-in-Toss mini-app users.
-- Toss-login users authenticate via Bearer (no cookies), so consent is recorded
-- directly against auth_user_id via createClaimedLegalConsentRecord(flow='toss').
-- Additive: same terms/privacy versions, provider must be null (no OAuth provider).

alter table public.legal_consents
  drop constraint if exists legal_consents_flow_check,
  drop constraint if exists legal_consents_flow_provider_check;

alter table public.legal_consents
  add constraint legal_consents_flow_check
  check (flow in ('email', 'oauth', 'guest', 'toss')),
  add constraint legal_consents_flow_provider_check
  check (
    (flow in ('email', 'guest', 'toss') and provider is null)
    or
    (flow = 'oauth' and provider is not null)
  );
