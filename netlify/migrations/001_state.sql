-- One row per site. Operational collections are small and independent of site history.
CREATE TABLE IF NOT EXISTS seobestia_parts (
    kind text NOT NULL,
    item text NOT NULL DEFAULT '',
    body jsonb NOT NULL,
    summary jsonb,
    sequence bigint GENERATED ALWAYS AS IDENTITY,
    PRIMARY KEY(kind,item)
);
