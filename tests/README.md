# Tenant-isolation tests

Run the local suite with:

```powershell
npm test
```

The suite uses Node's built-in test runner and requires no secrets, network
access, Supabase project, or additional packages. It combines executable mock
checks for invitation role/workspace decisions with source-contract checks for
the migration and API boundaries that enforce tenancy.

Coverage includes:

- workspace-member RLS for `bids`, `estimates`, `proposals`, and `documents`;
- removal of every known legacy policy that could bypass workspace RLS;
- invite creation pinned to the authenticated caller's workspace;
- invite acceptance ignoring request-supplied roles and rejecting `owner`;
- private-schema placement and policy usability of security-definer helpers;
- initplan-safe profile policies and explicit service-role-only markers; and
- all 17 foreign-key indexes requested by the Supabase advisor.

The M2 foundation tests additionally cover deterministic trade/unit/item
normalization, exact workspace/unit filtering, source-kind separation,
recency-weighted robust suggestions, explicit insufficient-evidence responses,
and the service-write-only `cost_observations` schema contract.

These fast tests protect the repository contract and are safe for CI. They do
not connect to or mutate the live Supabase project. A disposable local Supabase
integration test can be added later when the project adopts the Supabase CLI;
it must remain opt-in and must never use production credentials.
