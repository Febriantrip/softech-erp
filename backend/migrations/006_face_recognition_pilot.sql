-- SOFTECH V12.3 optional custom face matching PILOT. Run in softech_erp as postgres.
-- No photos are persisted; stored SFace vector must be encrypted by Go AES-GCM.
BEGIN;
CREATE TABLE IF NOT EXISTS erp.user_face_profiles (
    user_id uuid PRIMARY KEY REFERENCES erp.users(id) ON DELETE CASCADE,
    descriptor bytea NOT NULL,
    model_version varchar(80) NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS erp.face_challenges (
    id varchar(80) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES erp.users(id) ON DELETE CASCADE,
    purpose varchar(20) NOT NULL CHECK (purpose IN ('login','register')),
    steps text[] NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_face_challenges_expiry ON erp.face_challenges(expires_at);
GRANT USAGE ON SCHEMA erp TO softech_erp;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp.user_face_profiles,erp.face_challenges TO softech_erp;
COMMIT;
