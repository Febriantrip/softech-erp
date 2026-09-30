-- Distributor ERP V8 · Enterprise Governance & Control
-- MySQL 8.x starter schema. Apply after the earlier ERP schemas.
-- User identity may be supplied by SSO/IdP; adapt `security_users` or map it to your existing user table.

CREATE TABLE security_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  display_name VARCHAR(180) NOT NULL,
  email VARCHAR(180) NULL,
  status ENUM('ACTIVE','DISABLED','LOCKED') NOT NULL DEFAULT 'ACTIVE',
  mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_security_username (username),
  UNIQUE KEY uk_security_email (email)
);

CREATE TABLE security_roles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_code VARCHAR(60) NOT NULL,
  role_name VARCHAR(160) NOT NULL,
  description VARCHAR(255) NULL,
  is_privileged TINYINT(1) NOT NULL DEFAULT 0,
  can_override_sod TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_security_role_code (role_code)
);

CREATE TABLE security_permissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  permission_code VARCHAR(100) NOT NULL,
  module_code VARCHAR(60) NOT NULL,
  action_code VARCHAR(60) NOT NULL,
  description VARCHAR(255) NULL,
  UNIQUE KEY uk_security_permission_code (permission_code)
);

CREATE TABLE security_role_permissions (
  role_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_srp_role FOREIGN KEY (role_id) REFERENCES security_roles(id),
  CONSTRAINT fk_srp_permission FOREIGN KEY (permission_id) REFERENCES security_permissions(id)
);

CREATE TABLE security_user_role_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NULL,
  status ENUM('ACTIVE','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ura_user_scope (user_id, entity_id, site_id, status),
  CONSTRAINT fk_ura_user FOREIGN KEY (user_id) REFERENCES security_users(id),
  CONSTRAINT fk_ura_role FOREIGN KEY (role_id) REFERENCES security_roles(id),
  CONSTRAINT fk_ura_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_ura_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE approval_policies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  policy_code VARCHAR(60) NOT NULL,
  policy_name VARCHAR(180) NOT NULL,
  document_type VARCHAR(60) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  min_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  max_amount DECIMAL(20,2) NULL,
  approval_mode ENUM('SEQUENTIAL','PARALLEL') NOT NULL DEFAULT 'SEQUENTIAL',
  allow_self_approval TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  priority INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_approval_policy_code (policy_code),
  KEY idx_approval_match (document_type, entity_id, status, min_amount, max_amount),
  CONSTRAINT fk_approval_policy_entity FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE approval_policy_steps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_policy_id BIGINT UNSIGNED NOT NULL,
  step_no INT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  step_label VARCHAR(120) NULL,
  minimum_approvers INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uk_approval_policy_step (approval_policy_id, step_no),
  CONSTRAINT fk_aps_policy FOREIGN KEY (approval_policy_id) REFERENCES approval_policies(id),
  CONSTRAINT fk_aps_role FOREIGN KEY (role_id) REFERENCES security_roles(id)
);

CREATE TABLE approval_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_no VARCHAR(50) NOT NULL,
  document_type VARCHAR(60) NOT NULL,
  document_id VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NULL,
  document_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  maker_user_id BIGINT UNSIGNED NOT NULL,
  approval_policy_id BIGINT UNSIGNED NOT NULL,
  current_step_no INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  submitted_at DATETIME NOT NULL,
  completed_at DATETIME NULL,
  rejection_reason VARCHAR(500) NULL,
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uk_approval_request_no (request_no),
  KEY idx_approval_queue (entity_id, site_id, status, current_step_no),
  CONSTRAINT fk_arq_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_arq_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_arq_maker FOREIGN KEY (maker_user_id) REFERENCES security_users(id),
  CONSTRAINT fk_arq_policy FOREIGN KEY (approval_policy_id) REFERENCES approval_policies(id)
);

CREATE TABLE approval_request_actions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  approval_request_id BIGINT UNSIGNED NOT NULL,
  step_no INT UNSIGNED NOT NULL,
  required_role_id BIGINT UNSIGNED NOT NULL,
  action ENUM('APPROVE','REJECT','RETURN','OVERRIDE') NOT NULL,
  actor_user_id BIGINT UNSIGNED NOT NULL,
  delegated_from_user_id BIGINT UNSIGNED NULL,
  acted_at DATETIME NOT NULL,
  note VARCHAR(500) NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  UNIQUE KEY uk_approval_action_idempotency (idempotency_key),
  KEY idx_approval_action_request (approval_request_id, step_no),
  CONSTRAINT fk_ara_request FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id),
  CONSTRAINT fk_ara_role FOREIGN KEY (required_role_id) REFERENCES security_roles(id),
  CONSTRAINT fk_ara_actor FOREIGN KEY (actor_user_id) REFERENCES security_users(id),
  CONSTRAINT fk_ara_delegate_from FOREIGN KEY (delegated_from_user_id) REFERENCES security_users(id)
);

CREATE TABLE approval_delegations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  from_user_id BIGINT UNSIGNED NOT NULL,
  to_user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  reason VARCHAR(255) NULL,
  status ENUM('ACTIVE','REVOKED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_delegation_lookup (to_user_id, role_id, entity_id, effective_from, effective_to, status),
  CONSTRAINT fk_del_from FOREIGN KEY (from_user_id) REFERENCES security_users(id),
  CONSTRAINT fk_del_to FOREIGN KEY (to_user_id) REFERENCES security_users(id),
  CONSTRAINT fk_del_role FOREIGN KEY (role_id) REFERENCES security_roles(id),
  CONSTRAINT fk_del_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT chk_delegation_different_user CHECK (from_user_id <> to_user_id),
  CONSTRAINT chk_delegation_date CHECK (effective_to >= effective_from)
);

CREATE TABLE document_number_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_type VARCHAR(60) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  site_id BIGINT UNSIGNED NULL,
  document_code VARCHAR(30) NOT NULL,
  number_template VARCHAR(180) NOT NULL,
  reset_policy ENUM('MONTHLY','YEARLY','NEVER') NOT NULL DEFAULT 'MONTHLY',
  current_period VARCHAR(20) NULL,
  last_number BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uk_number_rule_scope (document_type, entity_id, site_id),
  CONSTRAINT fk_num_rule_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_num_rule_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE document_control_policies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_type VARCHAR(60) NOT NULL,
  locked_status_json JSON NOT NULL,
  posting_field VARCHAR(60) NULL,
  posting_values_json JSON NULL,
  correction_mode ENUM('REVERSAL','CREDIT_NOTE','DEBIT_NOTE','NEW_COUNT','NEW_DOCUMENT') NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  UNIQUE KEY uk_document_control_type (document_type)
);

CREATE TABLE governance_system_policies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  policy_key VARCHAR(100) NOT NULL,
  category VARCHAR(60) NOT NULL,
  policy_value JSON NOT NULL,
  description VARCHAR(255) NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  UNIQUE KEY uk_governance_policy_key (policy_key)
);

CREATE TABLE governance_audit_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_uuid CHAR(36) NOT NULL,
  event_at DATETIME(6) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  entity_id BIGINT UNSIGNED NULL,
  site_id BIGINT UNSIGNED NULL,
  module_code VARCHAR(60) NOT NULL,
  document_type VARCHAR(60) NULL,
  document_id VARCHAR(80) NULL,
  action_code VARCHAR(60) NOT NULL,
  field_name VARCHAR(120) NULL,
  old_value_json JSON NULL,
  new_value_json JSON NULL,
  severity ENUM('INFO','WARNING','CRITICAL') NOT NULL DEFAULT 'INFO',
  request_id VARCHAR(100) NULL,
  ip_address VARBINARY(16) NULL,
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_audit_event_uuid (event_uuid),
  KEY idx_audit_document (document_type, document_id, event_at),
  KEY idx_audit_actor (actor_user_id, event_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES security_users(id),
  CONSTRAINT fk_audit_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_audit_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE user_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  site_id BIGINT UNSIGNED NULL,
  notification_type VARCHAR(60) NOT NULL,
  priority ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM',
  title VARCHAR(180) NOT NULL,
  message VARCHAR(500) NOT NULL,
  target_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL,
  read_at DATETIME NULL,
  KEY idx_user_notification_inbox (user_id, read_at, created_at),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES security_users(id),
  CONSTRAINT fk_notification_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_notification_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE security_login_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  session_token_hash CHAR(64) NOT NULL,
  started_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  ip_address VARBINARY(16) NULL,
  user_agent VARCHAR(500) NULL,
  UNIQUE KEY uk_session_token_hash (session_token_hash),
  KEY idx_session_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES security_users(id)
);

-- Production rules:
-- 1. Permission checks happen on every backend command and query scope.
-- 2. Approval action must lock approval_requests row and increment row_version.
-- 3. Maker/checker is validated server-side; UI state is never authoritative.
-- 4. Privileged role assignment checks MFA status in one database transaction.
-- 5. Document numbering allocation uses SELECT ... FOR UPDATE or database sequences.
-- 6. Audit events are append-only. Application roles receive INSERT/SELECT but no UPDATE/DELETE.
-- 7. Posted/closed documents are immutable; corrections create linked reversal/correction documents.
-- 8. Session tokens are stored only as cryptographic hashes and can be centrally revoked.
