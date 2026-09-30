# V8 Enterprise Governance & Control

V8 is built on the V7.1 style-preserved baseline. The existing Aurora visual system is deliberately left intact. `styles.css`, `enterprise.css`, `Sidebar.jsx`, `Topbar.jsx`, and `AppShell.jsx` are unchanged. New governance-specific selectors live in `src/governance.css`.

## Functional scope

### Role Based Access Control
- user registry
- role registry
- granular module/action permissions
- privileged-role marker
- SoD override permission
- role assignment by legal entity and site
- privileged role assignment blocked when MFA policy is enabled and the user has no MFA

### Approval Matrix
- policy matching by document type, entity, and monetary threshold
- sequential approval steps
- maker/checker separation
- delegated approver support
- auditable SoD override
- rejection with reason
- automatic workflow completion updates the underlying document

Integrated document types:
- Sales Order
- Customer Credit Override
- Purchase Request
- Purchase Order
- Stock Take variance

### Document Numbering
Business document number is separated from the internal application ID. New transactions keep a stable internal ID while receiving a governed `documentNo` using tokens such as:

`{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}`

Integrated creators:
- Sales Order
- Purchase Request
- RFQ
- Purchase Order
- Goods Receipt
- Sales Invoice
- Purchase Invoice
- Stock Take

### Document Lock / Correction Policy
The policy registry identifies statuses that must be treated as immutable and the allowed correction model, such as reversal, credit note, debit note, or new stock count. Existing transaction pages already enforce status-based editing rules; V8 centralizes the governance policy so backend enforcement can use the same source of truth.

### Approval Delegation
Temporary delegation is explicit by:
- original approver
- substitute approver
- role
- entity
- start and end date
- reason

Delegation never rewrites the permanent role assignment.

### Audit Explorer
Global audit events capture:
- actor
- timestamp
- entity/site
- module
- document type and ID
- action
- field
- old value
- new value
- severity

Governance configuration changes and approval actions write to this audit ledger. Critical operational actions also add global events in addition to their existing per-document audit trail.

### Notification Center
The prototype includes user-scoped notifications for approval, security, and operational alerts with read/unread state.

### System Policies
Current configurable controls include:
- maker/checker required
- privileged role requires MFA
- session timeout
- block closed-period posting
- immutable audit events

## Approval lifecycle

`Draft → Submit → Approval Request → Step 1 → Step N → Approved`

A rejected request records the approver and reason. Stock Take rejection returns the count sheet to Counting; other governed documents are marked Rejected.

## Style preservation contract

V8 does not rewrite the baseline design system. Validation compares these files byte-for-byte with V7.1:
- `src/styles.css`
- `src/enterprise.css`
- `src/layout/Sidebar.jsx`
- `src/layout/Topbar.jsx`
- `src/layout/AppShell.jsx`

Only governance-scoped CSS is added.

## Production boundary

The browser prototype still persists data in localStorage. Production governance must be server-authoritative. Recommended controls:
- authentication/SSO and MFA at the identity layer
- authorization checks on every backend command, never only in React
- DB transactions and row/version locking
- immutable append-only audit table with restricted DB privileges
- signed approval actions and idempotency keys
- backend document-number allocation with row locking or database sequences
- enforced period/entity/site ownership on server
- session revocation and centralized token expiry
- encrypted secrets and no credential material in browser storage
