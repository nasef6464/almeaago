# Identity Closure Audit

Legacy reference: `almeaacodax/server/src/routes/auth.routes.ts`.

This document prevents unrelated legacy auth-router responsibilities from being rebuilt inside the Identity domain.

| Legacy capability | V2 owner | Status / decision |
|---|---|---|
| register / login / logout / me | Identity | implemented and tested |
| National ID login | Identity | implemented and tested |
| phone + password login | Identity | implemented and tested |
| Google OAuth | Identity | implemented and tested; live credentials pending staging |
| WhatsApp OTP | Identity | implemented and tested; live provider pending staging |
| forgot/reset password | Identity | implemented and tested |
| email verification/resend | Identity | implemented and tested |
| csrf-token | Identity | canonical route is `/csrf`; legacy alias retained |
| admin users lifecycle | Identity | implemented and tested |
| me/profile | Identity | implemented in account-profile closure slice |
| me/identity | Identity | implemented in account-profile closure slice |
| me/preferences | Learning | do not move into Identity; includes favorites/review/progress/path state |
| me/purchase | Commerce | legacy direct unlock already blocked; Commerce owns purchase/entitlement flow |
| me/redeem-access-code | Commerce | Commerce owns code reservation, entitlement and seat logic |
| parent/link-student | Parents / Organizations | ownership and consent scope; implement with canonical relationship model |
| parent/unlink-student | Parents / Organizations | relationship lifecycle |
| parent/linked-students | Parents / Organizations | scoped relationship read |
| admin/trainers | Reporting / Organizations | trainer directory depends on managed path/subject scope |
| admin/trainers/:id | Reporting / Organizations | trainer detail and scope |
| trainer/performance | Reporting | analytics/read model |
| school/group fields on admin user mutation | Organizations | wired through explicit Organizations transaction contract |

## Compatibility aliases retained

V2 keeps these legacy names as aliases while using clearer canonical endpoints:

- `GET /api/v1/auth/csrf-token` -> `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/email/resend-verification` -> `POST /api/v1/auth/email/resend`
- `GET /api/v1/auth/google/call` -> Google callback

## Intentional changes

### Profile avatar payload size

Legacy profile/admin routes could accept very large avatar strings/data URIs.

V2 Identity accepts only a small reference-sized string (max 2000 chars). Media bytes belong in object storage and later media-upload flows, not in the users table or ordinary JSON API payloads.

This is required by the ALMEAA media/bandwidth policy.

### Organization scope writes

Legacy auth routes directly mutated school/group/parent/teacher relationships.

V2 preserves the observable admin flow without making Identity own those foreign tables:
- Identity owns the account/role mutation and transaction boundary.
- Organizations owns school/class/parent relationship SQL through an explicit transaction-aware contract.
- Reporting owns the cross-domain admin user-directory read model.
- trainer managed path/subject scope remains with Catalog/Content and is rejected explicitly until connected.

## Exit criteria for Identity functional closure

Identity can be considered functionally closed when:
1. admin + self-account slice is Backend/Database CI green and merged;
2. live Google/WhatsApp provider smoke is tracked as an external staging gate;
3. desktop/mobile Auth screenshots are compared against legacy;
4. organization-owned and trainer/reporting flows remain tracked in their destination domains.

Only then may the Identity parity row move beyond TESTED toward PARITY_PROVEN.
