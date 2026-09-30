# Security

SOFTECH ERP is published as a **portfolio/development snapshot**. Do not reuse the example development configuration as-is for an internet-facing production deployment.

## Secrets and local configuration

Keep real credentials outside Git:

- PostgreSQL passwords
- JWT signing secrets
- biometric/template encryption keys
- API credentials
- production environment files

Use the committed `.env.example` files only as templates. Real `.env` files are intentionally ignored.

The application requires a JWT secret of at least 32 characters, and the Docker Compose stack requires PostgreSQL and JWT secrets to be supplied explicitly.

## Authentication

Current security-related foundations include:

- database-backed users
- BCrypt password hashing
- bearer-token authentication
- role/entity/site access context
- login-attempt controls
- passkey support
- optional face-authentication pilot

The face flow is a pilot and should not be treated as certified biometric anti-spoofing or liveness verification.

## Reporting a security issue

Please avoid posting real credentials, personal data, database dumps, biometric material, or exploitable production details in public issues.

For portfolio review, use synthetic/demo data only.
