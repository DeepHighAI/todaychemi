-- Allow guest pre-signup legal consent records for session-only first-run trials.
-- Guest records use the same hashed nonce cookie evidence and can later be
-- claimed by an auth user during guest-to-account conversion.

alter table public.legal_consents
  drop constraint if exists legal_consents_flow_check,
  drop constraint if exists legal_consents_flow_provider_check;

alter table public.legal_consents
  add constraint legal_consents_flow_check
  check (flow in ('email', 'oauth', 'guest')),
  add constraint legal_consents_flow_provider_check
  check (
    (flow in ('email', 'guest') and provider is null)
    or
    (flow = 'oauth' and provider is not null)
  );
