// Package SQL with the function so cold starts do not depend on a runtime filesystem layout.
export const schemaSQL=`-- One row per site. Operational collections are small and independent of site history.
CREATE TABLE IF NOT EXISTS seobestia_parts (
    kind text NOT NULL,
    item text NOT NULL DEFAULT '',
    body jsonb NOT NULL,
    summary jsonb,
    sequence bigint GENERATED ALWAYS AS IDENTITY,
    PRIMARY KEY(kind,item)
);
-- Project-wide credentials are isolated from user-facing site data and application backups.
CREATE TABLE IF NOT EXISTS seobestia_google_vault (
    target text PRIMARY KEY CHECK (target IN ('gsc','ga4')),
    envelope bytea NOT NULL CHECK (octet_length(envelope) BETWEEN 30 AND 32768)
);`;

