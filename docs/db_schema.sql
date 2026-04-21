CREATE TABLE app_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
CREATE TABLE reference_tables (
                category TEXT NOT NULL,
                item_id TEXT NOT NULL,
                label TEXT NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (category, item_id)
            );
CREATE TABLE planner_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL
            );
CREATE TABLE manual_cashflow_inputs (
                type TEXT NOT NULL,
                item_id TEXT NOT NULL,
                label TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL DEFAULT 0,
                amount_monthly REAL DEFAULT 0,
                notes TEXT DEFAULT '',
                payload TEXT NOT NULL,
                PRIMARY KEY (type, item_id)
            );
CREATE TABLE path_templates (
                path_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                payload TEXT NOT NULL
            );
CREATE TABLE scenario_forks (
                scenario_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path_template_id TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                notes TEXT DEFAULT '',
                selected_company_id TEXT,
                selected_employer_id TEXT,
                selected_va_rating_id TEXT,
                selected_phd_program_id TEXT,
                use_va INTEGER NOT NULL DEFAULT 1,
                use_gi_bill INTEGER NOT NULL DEFAULT 1,
                overrides TEXT NOT NULL
            , display_name TEXT, color_token TEXT, is_loaded INTEGER NOT NULL DEFAULT 0, display_order INTEGER NOT NULL DEFAULT 0, path_timeline_json TEXT DEFAULT '');
CREATE TABLE projection_runs (
                scenario_id TEXT NOT NULL,
                year_index INTEGER NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (scenario_id, year_index)
            );
CREATE TABLE scenario_metrics (
                scenario_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            );
CREATE TABLE gap_flags (
                gap_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                impact TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL
            );
CREATE TABLE reference_overrides (
                domain TEXT NOT NULL,
                record_id TEXT NOT NULL,
                field TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'global',
                value REAL NOT NULL,
                reason TEXT DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, value_json TEXT DEFAULT '',
                PRIMARY KEY (domain, record_id, field, scope)
            );
CREATE TABLE source_claims (
                claim_id TEXT PRIMARY KEY,
                target_domain TEXT NOT NULL,
                target_record_id TEXT NOT NULL,
                target_field TEXT NOT NULL,
                friendly_target_label TEXT NOT NULL,
                field_label TEXT NOT NULL,
                current_value_snapshot TEXT DEFAULT '',
                research_note TEXT DEFAULT '',
                verification_status TEXT DEFAULT 'unverified',
                placeholder_status TEXT DEFAULT 'source_pending',
                section_id TEXT DEFAULT ''
            );
CREATE TABLE source_documents (
                document_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                publisher TEXT DEFAULT '',
                url TEXT DEFAULT '',
                source_type TEXT DEFAULT '',
                published_date TEXT DEFAULT '',
                accessed_date TEXT DEFAULT '',
                notes TEXT DEFAULT ''
            );
CREATE TABLE source_claim_documents (
                claim_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                role TEXT DEFAULT 'supporting',
                sort_order INTEGER NOT NULL DEFAULT 0,
                note_excerpt TEXT DEFAULT '',
                PRIMARY KEY (claim_id, document_id)
            );
CREATE TABLE manual_finance_sections (
                bucket TEXT NOT NULL,
                section_id TEXT NOT NULL,
                label TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                is_default INTEGER NOT NULL DEFAULT 1,
                payload TEXT NOT NULL,
                PRIMARY KEY (bucket, section_id)
            );
CREATE TABLE manual_finance_items (
                bucket TEXT NOT NULL,
                section_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                label TEXT NOT NULL,
                amount REAL DEFAULT 0,
                amount_monthly REAL DEFAULT 0,
                notes TEXT DEFAULT '',
                is_custom INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                source_ref_id TEXT DEFAULT '',
                payload TEXT NOT NULL,
                PRIMARY KEY (bucket, section_id, item_id)
            );
CREATE TABLE source_claim_overrides (
                claim_id TEXT PRIMARY KEY,
                research_note TEXT DEFAULT '',
                verification_status TEXT DEFAULT '',
                placeholder_status TEXT DEFAULT '',
                evidence_tier TEXT DEFAULT '',
                confidence TEXT DEFAULT '',
                estimate_rationale TEXT DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
