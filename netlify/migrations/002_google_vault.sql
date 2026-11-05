-- Project-wide credentials are isolated from user-facing site data and application backups.
CREATE TABLE IF NOT EXISTS seobestia_google_vault (
    target text PRIMARY KEY CHECK (target IN ('gsc','ga4')),
    envelope bytea NOT NULL CHECK (octet_length(envelope) BETWEEN 30 AND 32768)
);
