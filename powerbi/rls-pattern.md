# Branch-level security design pattern (not active enforcement)

This document describes a production implementation pattern. The public FIELDIQ website contains synthetic data and does not authenticate users, enforce RLS / OLS, or restrict rows by identity.

## Proposed entitlement table

| Column | Purpose |
|---|---|
| `user_principal_name` | Entra ID user principal name |
| `branch_key` | Branch permitted for the user |
| `access_level` | Optional role / permission tier |

## Implementation outline

1. Maintain an approved user-to-branch mapping in a governed security table.
2. Relate the entitlement table to `dim_branch` using `branch_key`.
3. Apply a dynamic RLS expression using the signed-in user's identity (for example, `USERPRINCIPALNAME()`).
4. Test single-branch, multi-branch, regional, and no-entitlement users.
5. Review filter propagation through every fact relationship, including `fact_fleet_day`.
6. Use OLS separately for sensitive model objects or columns where required; RLS alone does not hide metadata.
7. Validate permissions in the Power BI service / Fabric workspace, not only in Desktop.

## Security boundary

This is design documentation only. No Entra ID tenant, identity mapping, RLS role, OLS rule, workspace permission, or service-side test is included. Never use this public demo as an example of production access control.
