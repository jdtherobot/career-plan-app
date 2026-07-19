from __future__ import annotations

import copy
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from app import export_reference_research
from planner_app import database as database_module
from planner_app.database import fetch_bootstrap, get_connection, initialize_database, replace_research_import_bundle, save_reference_override, save_scenario
from planner_app.engine import compare_scenarios, determine_phase, project_scenario
from planner_app.manual_finance import LEGACY_MANUAL_BASELINE, flatten_manual_finance_group, migrate_legacy_manual_inputs, normalize_manual_finance_payload
from planner_app.reference_data import (
    REFERENCE_DOMAINS,
    build_auto_source_registry,
    build_compatibility_reference_tables,
    editable_reference_fields,
    hydrate_military_reference_domains,
    validate_military_reference_state,
)
from planner_app.research_workbook import (
    accepted_source_fingerprint,
    accepted_state_hash,
    build_research_import_bundle,
    ensure_reference_research_conflict_csv,
    load_reference_research_conflict_rows,
    load_reference_research_rows,
    reconcile_reference_research_rows,
    REFERENCE_RESEARCH_PROMPT,
    write_reference_research_prompt,
    write_reference_research_workbook,
)
from planner_app.seed_data import MANUAL_CASHFLOW_SEED, PLANNER_PROFILE, REFERENCE_TABLES, SCENARIO_SEEDS


class ProjectionEngineTests(unittest.TestCase):
    def test_phase_transitions_are_correct(self) -> None:
        self.assertEqual(determine_phase("PATH_A", 8)[0], "retirement_transition")
        self.assertEqual(determine_phase("PATH_B", 2)[0], "tech_career")
        self.assertEqual(determine_phase("PATH_C", 2)[0], "gap_year")
        self.assertEqual(determine_phase("PATH_C", 8)[0], "research_only")

    def test_projection_generates_full_horizon(self) -> None:
        projection, metrics = project_scenario(
            SCENARIO_SEEDS[0],
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )
        self.assertEqual(len(projection), 51)
        self.assertGreater(metrics["finalPortfolio"], 0)
        self.assertGreater(metrics["lifetimePensionValue"], 0)

    def test_path_custom_military_retirement_coerces_to_path_a_projection(self) -> None:
        scenario = copy.deepcopy(SCENARIO_SEEDS[0])
        scenario["pathTemplateId"] = "PATH_CUSTOM"
        scenario["selectedCompanyId"] = "GENERIC_IC"
        scenario["selectedEmployerId"] = "CONSERVATIVE"
        scenario["selectedPhdProgramId"] = "STAN-CS-PHD"
        scenario["useGiBill"] = True
        scenario["pathTimeline"] = {
            "version": 1,
            "serviceExit": {"type": "military_retirement", "year": 2034},
            "blocks": [
                {"id": "tech_1", "type": "tech_career", "startYear": 2035},
                {"id": "retire_1", "type": "retire", "startYear": 2040},
            ],
        }

        projection, metrics = project_scenario(
            scenario,
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )

        phd_row = next(row for row in projection if row["calendarYear"] == 2035)
        research_row = next(row for row in projection if row["calendarYear"] == 2040)
        self.assertEqual(phd_row["phaseId"], "retired_phd")
        self.assertEqual(phd_row["activityType"], "grad_school")
        self.assertEqual(phd_row["serviceStatus"], "military_retired")
        self.assertGreater(phd_row["incomeBreakdown"]["pension"], 0)
        self.assertEqual(research_row["phaseId"], "retired_research")
        self.assertEqual(research_row["activityType"], "research_career")
        self.assertGreater(metrics["lifetimePensionValue"], 0)

    def test_path_custom_separation_tech_only_coerces_to_path_b_projection(self) -> None:
        scenario = copy.deepcopy(SCENARIO_SEEDS[1])
        scenario["pathTemplateId"] = "PATH_CUSTOM"
        scenario["selectedCompanyId"] = "GENERIC_IC"
        scenario["selectedEmployerId"] = None
        scenario["selectedPhdProgramId"] = None
        scenario["useGiBill"] = False
        scenario["pathTimeline"] = {
            "version": 1,
            "serviceExit": {"type": "separation", "year": 2027},
            "blocks": [
                {"id": "tech_1", "type": "tech_career", "startYear": 2028},
            ],
        }

        projection, _ = project_scenario(
            scenario,
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )

        tech_row = next(row for row in projection if row["calendarYear"] == 2028)
        self.assertEqual(tech_row["activityType"], "tech_career")
        self.assertEqual(tech_row["serviceStatus"], "separated")
        self.assertEqual(tech_row["phaseId"], "tech_career")

    def test_path_custom_separation_grad_or_research_coerces_to_path_c_projection(self) -> None:
        scenario = copy.deepcopy(SCENARIO_SEEDS[2])
        scenario["pathTemplateId"] = "PATH_CUSTOM"
        scenario["selectedCompanyId"] = "GENERIC_IC"
        scenario["selectedEmployerId"] = "CONSERVATIVE"
        scenario["selectedPhdProgramId"] = "STAN-CS-PHD"
        scenario["useGiBill"] = True
        scenario["pathTimeline"] = {
            "version": 1,
            "serviceExit": {"type": "separation", "year": 2027},
            "blocks": [
                {"id": "research_1", "type": "research_career", "startYear": 2028},
                {"id": "tech_1", "type": "tech_career", "startYear": 2032},
            ],
        }

        projection, _ = project_scenario(
            scenario,
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )

        gap_row = next(row for row in projection if row["calendarYear"] == 2028)
        phd_row = next(row for row in projection if row["calendarYear"] == 2030)
        self.assertEqual(gap_row["phaseId"], "gap_year")
        self.assertEqual(phd_row["phaseId"], "phd_only")
        self.assertEqual(phd_row["activityType"], "grad_school")

    def test_tax_free_income_in_active_duty_year_zero(self) -> None:
        projection, _ = project_scenario(
            SCENARIO_SEEDS[0],
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )
        first_row = projection[0]
        expected_tax_free = REFERENCE_TABLES["military_bah_rates"][0]["annualizedRate"] + REFERENCE_TABLES["military_bas_rates"][0]["annualizedRate"]
        self.assertAlmostEqual(first_row["taxFreeIncome"], round(expected_tax_free, 2), places=2)
        self.assertAlmostEqual(first_row["totalIncome"], round(first_row["grossIncome"] + first_row["taxFreeIncome"], 2), places=2)

    def test_path_a_location_shift_resolves_langley_reference_in_2027(self) -> None:
        projection, _ = project_scenario(
            SCENARIO_SEEDS[0],
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )
        self.assertEqual(
            projection[0]["sourceRefs"]["militaryBah"][0]["targetId"],
            "reference-military_pay_rates-bah_sacramento_2026",
        )
        self.assertEqual(
            projection[1]["sourceRefs"]["militaryBah"][0]["targetId"],
            "reference-military_pay_rates-bah_langley_2026",
        )

    def test_military_schedule_progresses_from_e7_12_yos_to_retirement(self) -> None:
        hydrated = hydrate_military_reference_domains(copy.deepcopy(REFERENCE_DOMAINS), PLANNER_PROFILE)
        schedule = hydrated["military_compensation_projection_view"]
        self.assertEqual(schedule[0]["calendarYear"], 2026)
        self.assertEqual(schedule[0]["yearsOfService"], 12)
        self.assertEqual(schedule[0]["projectedPayGradeNumeric"], 7)
        self.assertEqual(schedule[-1]["calendarYear"], 2034)
        self.assertEqual(schedule[-1]["yearsOfService"], 20)
        self.assertEqual(schedule[-1]["projectedPayGradeNumeric"], 7)
        self.assertEqual(schedule[0]["locationId"], "sacramento_ca")
        self.assertEqual(schedule[1]["locationId"], "langley_hampton_roads_va")
        self.assertAlmostEqual(schedule[1]["raisePercent"], 0.026, places=6)

    def test_active_duty_projection_exposes_resolved_military_schedule_fields(self) -> None:
        projection, _ = project_scenario(
            SCENARIO_SEEDS[0],
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )
        first_row = projection[0]
        second_row = projection[1]
        self.assertEqual(first_row["incomeBreakdown"]["military"]["projectedPayGrade"], "E-7")
        self.assertEqual(first_row["incomeBreakdown"]["military"]["yearsOfService"], 12)
        self.assertAlmostEqual(second_row["incomeBreakdown"]["military"]["raisePercent"], 0.026, places=6)
        self.assertGreater(second_row["incomeBreakdown"]["military"]["totalComp"], first_row["incomeBreakdown"]["military"]["totalComp"])
        self.assertTrue(second_row["sourceRefs"]["militaryRaiseSchedule"])

    def test_military_promotion_validation_rejects_invalid_paths(self) -> None:
        invalid_jump = copy.deepcopy(REFERENCE_DOMAINS)
        slot_one = next(item for item in invalid_jump["military_promotion_schedule"] if item["id"] == "promotion_slot_1")
        slot_one["enabledFlag"] = 1
        slot_one["targetPayGradeNumeric"] = 9
        slot_one["promotionYear"] = 2030
        with self.assertRaisesRegex(ValueError, "one enlisted grade at a time"):
            validate_military_reference_state(invalid_jump, PLANNER_PROFILE)

        invalid_tis = copy.deepcopy(REFERENCE_DOMAINS)
        slot_one = next(item for item in invalid_tis["military_promotion_schedule"] if item["id"] == "promotion_slot_1")
        slot_one["enabledFlag"] = 1
        slot_one["targetPayGradeNumeric"] = 8
        slot_one["promotionYear"] = 2028
        with self.assertRaisesRegex(ValueError, "years of service"):
            validate_military_reference_state(invalid_tis, PLANNER_PROFILE)

        too_many = copy.deepcopy(REFERENCE_DOMAINS)
        too_many["military_promotion_schedule"].append(
            {
                "id": "promotion_slot_3",
                "label": "Promotion Slot 3",
                "slotOrder": 3,
                "enabledFlag": 1,
                "promotionYear": 2034,
                "targetPayGradeNumeric": 9,
            }
        )
        for row in too_many["military_promotion_schedule"]:
            if row["id"] == "promotion_slot_1":
                row["enabledFlag"] = 1
                row["promotionYear"] = 2030
                row["targetPayGradeNumeric"] = 8
            if row["id"] == "promotion_slot_2":
                row["enabledFlag"] = 1
                row["promotionYear"] = 2033
                row["targetPayGradeNumeric"] = 9
        with self.assertRaisesRegex(ValueError, "at most two projected promotions"):
            validate_military_reference_state(too_many, PLANNER_PROFILE)

        beyond_e9 = copy.deepcopy(REFERENCE_DOMAINS)
        for row in beyond_e9["military_promotion_schedule"]:
            if row["id"] == "promotion_slot_1":
                row["enabledFlag"] = 1
                row["promotionYear"] = 2030
                row["targetPayGradeNumeric"] = 8
            if row["id"] == "promotion_slot_2":
                row["enabledFlag"] = 1
                row["promotionYear"] = 2033
                row["targetPayGradeNumeric"] = 10
        with self.assertRaisesRegex(ValueError, "cannot go beyond E-9"):
            validate_military_reference_state(beyond_e9, PLANNER_PROFILE)

    def test_retired_phd_breakdown_uses_program_and_gi_bill_benefit_records(self) -> None:
        projection, _ = project_scenario(
            SCENARIO_SEEDS[0],
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )
        retired_phd_row = projection[9]
        income = retired_phd_row["incomeBreakdown"]
        self.assertGreater(income["pension"], 0)
        self.assertGreater(income["phdStipend"], 0)
        self.assertGreater(income["vaCompensation"], 0)
        self.assertGreater(income["giBillHousing"], 0)
        self.assertGreater(income["giBillBooks"], 0)
        self.assertEqual(retired_phd_row["sourceRefs"]["phdStipend"][0]["targetId"], "reference-programs-STAN-CS-PHD")
        self.assertEqual(retired_phd_row["sourceRefs"]["giBillHousing"][0]["targetId"], "reference-gi_bill_benefits-gi_bill_bay_area")

    def test_engine_source_refs_now_point_to_reference_domains(self) -> None:
        projection, _ = project_scenario(
            SCENARIO_SEEDS[0],
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )
        first_row = projection[0]
        self.assertEqual(first_row["sourceRefs"]["healthcareCost"][0]["type"], "reference-data")
        self.assertIn("reference-healthcare_profiles-", first_row["sourceRefs"]["healthcareCost"][0]["targetId"])
        self.assertIn("reference-tax_profiles-", first_row["sourceRefs"]["taxes"][0]["targetId"])
        self.assertIn("reference-investment_policies-", first_row["sourceRefs"]["portfolioGrowth"][0]["targetId"])

    def test_two_layer_expense_resolver_can_add_location_defaults(self) -> None:
        domains = copy.deepcopy(REFERENCE_DOMAINS)
        for profile in domains["location_cost_profiles"]:
            if profile["id"] == "cost_stanford_ca":
                profile["housingMonthly"] = 100
                break
        compat = build_compatibility_reference_tables(domains)
        baseline_projection, _ = project_scenario(
            SCENARIO_SEEDS[2],
            PLANNER_PROFILE,
            REFERENCE_TABLES,
            MANUAL_CASHFLOW_SEED,
            REFERENCE_DOMAINS,
        )
        adjusted_projection, _ = project_scenario(
            SCENARIO_SEEDS[2],
            PLANNER_PROFILE,
            compat,
            MANUAL_CASHFLOW_SEED,
            domains,
        )
        added_cost = 100 * 12 * ((1 + 0.03) ** 3)
        self.assertAlmostEqual(
            adjusted_projection[3]["livingExpenses"] - baseline_projection[3]["livingExpenses"],
            round(added_cost, 2),
            delta=0.05,
        )

    def test_comparison_payload_returns_delta_rows(self) -> None:
        projections = {}
        for seed in SCENARIO_SEEDS[:2]:
            projection, metrics = project_scenario(seed, PLANNER_PROFILE, REFERENCE_TABLES, MANUAL_CASHFLOW_SEED, REFERENCE_DOMAINS)
            projections[seed["id"]] = {"projection": projection, "metrics": metrics}
        comparison = compare_scenarios(projections)
        self.assertEqual(len(comparison["comparisons"]), 1)


class ReferenceDataTests(unittest.TestCase):
    def _find_claim(self, bootstrap: dict[str, object], domain: str, record_id: str, field: str) -> dict[str, object]:
        return next(
            item
            for item in bootstrap["referencedValues"]
            if item["targetDomain"] == domain
            and item["targetRecordId"] == record_id
            and item["targetField"] == field
        )

    def test_workbook_backed_program_import_has_eight_rows(self) -> None:
        programs = REFERENCE_DOMAINS["programs"]
        self.assertEqual(len(programs), 8)
        stanford = next(item for item in programs if item["id"] == "STAN-CS-PHD")
        self.assertEqual(stanford["schoolName"], "Stanford")
        self.assertEqual(stanford["lastVerifiedDate"], "2026-03-22")
        self.assertNotIn("advisors", REFERENCE_DOMAINS)

    def test_program_duration_defaults_to_five_years(self) -> None:
        stanford = next(item for item in REFERENCE_TABLES["phd_programs"] if item["id"] == "STAN-CS-PHD")
        self.assertEqual(stanford["durationYears"], 5)

    def test_auto_source_registry_tracks_public_text_fields_and_skips_internal_domains(self) -> None:
        claims, _, _ = build_auto_source_registry(REFERENCE_DOMAINS)
        website_claim = next(
            item
            for item in claims
            if item["targetDomain"] == "programs"
            and item["targetRecordId"] == "STAN-CS-PHD"
            and item["targetField"] == "websiteUrl"
        )
        self.assertEqual(website_claim["fieldLabel"], "Website")
        self.assertFalse(any(item["targetDomain"] == "path_timeline_defaults" for item in claims))

    def test_international_gi_bill_record_is_structured_without_claiming_ineligibility(self) -> None:
        intl = next(item for item in REFERENCE_DOMAINS["gi_bill_benefits"] if item["id"] == "gi_bill_international_placeholder")
        self.assertEqual(intl["monthlyHousingAllowance"], 0.0)
        self.assertEqual(intl["eligibilityReason"], "international_rate_pending_research")

    def test_research_workbook_export_and_import_round_trip_supports_text_numeric_and_blank_reset(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            original_db_path = database_module.DB_PATH
            conn = None
            try:
                database_module.DB_PATH = Path(temp_dir) / "planner.db"
                initialize_database()
                conn = get_connection()
                bootstrap = fetch_bootstrap(conn)
                workbook_path = Path(temp_dir) / "reference_research.xlsx"
                exported_path, rows = write_reference_research_workbook(bootstrap=bootstrap, output_path=workbook_path)
                self.assertEqual(exported_path, workbook_path)
                self.assertEqual(len(rows), len(bootstrap["referencedValues"]))

                loaded_rows = load_reference_research_rows(workbook_path)
                untouched_bundle = build_research_import_bundle(rows=loaded_rows, bootstrap=bootstrap)
                self.assertFalse(untouched_bundle["value_overrides"])
                self.assertFalse(untouched_bundle["claim_overrides"])

                rows_by_id = {row["claim_id"]: row for row in loaded_rows}
                stipend_claim = self._find_claim(bootstrap, "programs", "STAN-CS-PHD", "stipendAnnual")
                website_claim = self._find_claim(bootstrap, "programs", "STAN-CS-PHD", "websiteUrl")

                stipend_row = rows_by_id[stipend_claim["id"]]
                stipend_row["proposed_value"] = 59000
                stipend_row["resolution_status"] = "public_verified"
                stipend_row["evidence_tier"] = "public"
                stipend_row["source_1_title"] = "Stanford CS funding page"
                stipend_row["source_1_url"] = "https://example.com/stanford-funding"

                website_row = rows_by_id[website_claim["id"]]
                website_row["proposed_value"] = "https://cs.stanford.edu/phd"
                website_row["resolution_status"] = "official_verified"
                website_row["evidence_tier"] = "official"
                website_row["source_1_title"] = "Stanford CS PhD"
                website_row["source_1_url"] = "https://cs.stanford.edu/phd"

                import_bundle = build_research_import_bundle(rows=loaded_rows, bootstrap=bootstrap)
                replace_research_import_bundle(
                    conn,
                    value_overrides=import_bundle["value_overrides"],
                    claim_overrides=import_bundle["claim_overrides"],
                    documents=import_bundle["documents"],
                    claim_documents=import_bundle["claim_documents"],
                )

                updated_bootstrap = fetch_bootstrap(conn)
                updated_stipend = self._find_claim(updated_bootstrap, "programs", "STAN-CS-PHD", "stipendAnnual")
                updated_website = self._find_claim(updated_bootstrap, "programs", "STAN-CS-PHD", "websiteUrl")
                self.assertEqual(updated_stipend["currentValue"], 59000)
                self.assertEqual(updated_stipend["verificationStatus"], "public_verified")
                self.assertEqual(updated_stipend["status"], "resolved")
                self.assertEqual(updated_website["currentValue"], "https://cs.stanford.edu/phd")
                self.assertGreater(updated_website["sourceCount"], 0)

                stipend_row["proposed_value"] = ""
                stipend_row["source_1_title"] = ""
                stipend_row["source_1_url"] = ""
                stipend_row["evidence_tier"] = ""
                stipend_row["resolution_status"] = ""
                reset_bundle = build_research_import_bundle(rows=loaded_rows, bootstrap=updated_bootstrap)
                replace_research_import_bundle(
                    conn,
                    value_overrides=reset_bundle["value_overrides"],
                    claim_overrides=reset_bundle["claim_overrides"],
                    documents=reset_bundle["documents"],
                    claim_documents=reset_bundle["claim_documents"],
                )
                reset_bootstrap = fetch_bootstrap(conn)
                reset_stipend = self._find_claim(reset_bootstrap, "programs", "STAN-CS-PHD", "stipendAnnual")
                self.assertEqual(reset_stipend["currentValue"], 57000)
            finally:
                if conn is not None:
                    conn.close()
                database_module.DB_PATH = original_db_path

    def test_global_reference_override_wins_over_research_import_scope(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            original_db_path = database_module.DB_PATH
            conn = None
            try:
                database_module.DB_PATH = Path(temp_dir) / "planner.db"
                initialize_database()
                conn = get_connection()
                bootstrap = fetch_bootstrap(conn)
                claim = self._find_claim(bootstrap, "programs", "STAN-CS-PHD", "stipendAnnual")
                rows = [row for row in load_reference_research_rows(write_reference_research_workbook(
                    bootstrap=bootstrap,
                    output_path=Path(temp_dir) / "precedence.xlsx",
                )[0])]
                rows_by_id = {row["claim_id"]: row for row in rows}
                rows_by_id[claim["id"]]["proposed_value"] = 59000
                rows_by_id[claim["id"]]["resolution_status"] = "public_verified"
                rows_by_id[claim["id"]]["evidence_tier"] = "public"
                rows_by_id[claim["id"]]["source_1_title"] = "Stanford CS funding page"
                rows_by_id[claim["id"]]["source_1_url"] = "https://example.com/stanford-funding"
                bundle = build_research_import_bundle(rows=rows, bootstrap=bootstrap)
                replace_research_import_bundle(
                    conn,
                    value_overrides=bundle["value_overrides"],
                    claim_overrides=bundle["claim_overrides"],
                    documents=bundle["documents"],
                    claim_documents=bundle["claim_documents"],
                )
                save_reference_override(conn, {"domain": "programs", "recordId": "STAN-CS-PHD", "field": "stipendAnnual", "value": 58000})
                updated_bootstrap = fetch_bootstrap(conn)
                updated_claim = self._find_claim(updated_bootstrap, "programs", "STAN-CS-PHD", "stipendAnnual")
                self.assertEqual(updated_claim["currentValue"], 58000)
            finally:
                if conn is not None:
                    conn.close()
                database_module.DB_PATH = original_db_path

    def test_research_import_text_override_survives_initialize_database_cleanup(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            original_db_path = database_module.DB_PATH
            conn = None
            try:
                database_module.DB_PATH = Path(temp_dir) / "planner.db"
                initialize_database()
                conn = get_connection()
                bootstrap = fetch_bootstrap(conn)
                rows = [row for row in load_reference_research_rows(write_reference_research_workbook(
                    bootstrap=bootstrap,
                    output_path=Path(temp_dir) / "cleanup-survival.xlsx",
                )[0])]
                rows_by_id = {row["claim_id"]: row for row in rows}
                term_claim = self._find_claim(bootstrap, "programs", "STAN-CS-PHD", "termStart")
                website_claim = self._find_claim(bootstrap, "programs", "STAN-CS-PHD", "websiteUrl")

                rows_by_id[term_claim["id"]]["proposed_value"] = "Autumn"
                rows_by_id[term_claim["id"]]["resolution_status"] = "official_verified"
                rows_by_id[term_claim["id"]]["evidence_tier"] = "official"
                rows_by_id[term_claim["id"]]["source_1_title"] = "Stanford CS deadlines"
                rows_by_id[term_claim["id"]]["source_1_url"] = "https://example.com/stanford-deadlines"

                rows_by_id[website_claim["id"]]["proposed_value"] = "https://cs.stanford.edu/admissions/phd-overview"
                rows_by_id[website_claim["id"]]["resolution_status"] = "official_verified"
                rows_by_id[website_claim["id"]]["evidence_tier"] = "official"
                rows_by_id[website_claim["id"]]["source_1_title"] = "Stanford CS admissions"
                rows_by_id[website_claim["id"]]["source_1_url"] = "https://example.com/stanford-admissions"

                bundle = build_research_import_bundle(rows=rows, bootstrap=bootstrap)
                replace_research_import_bundle(
                    conn,
                    value_overrides=bundle["value_overrides"],
                    claim_overrides=bundle["claim_overrides"],
                    documents=bundle["documents"],
                    claim_documents=bundle["claim_documents"],
                )
                conn.close()
                conn = None

                initialize_database()
                conn = get_connection()
                updated_bootstrap = fetch_bootstrap(conn)
                updated_term = self._find_claim(updated_bootstrap, "programs", "STAN-CS-PHD", "termStart")
                updated_website = self._find_claim(updated_bootstrap, "programs", "STAN-CS-PHD", "websiteUrl")

                self.assertEqual(updated_term["currentValue"], "Autumn")
                self.assertEqual(updated_term["verificationStatus"], "official_verified")
                self.assertGreater(updated_term["sourceCount"], 0)
                self.assertEqual(updated_website["currentValue"], "https://cs.stanford.edu/admissions/phd-overview")
                self.assertEqual(updated_website["verificationStatus"], "official_verified")
                self.assertGreater(updated_website["sourceCount"], 0)
            finally:
                if conn is not None:
                    conn.close()
                database_module.DB_PATH = original_db_path

    def test_conflict_log_file_is_created_once_and_then_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            conflict_path = Path(temp_dir) / "reference_research_conflicts.csv"
            created = ensure_reference_research_conflict_csv(conflict_path)
            self.assertEqual(created, conflict_path)
            initial_rows = load_reference_research_conflict_rows(conflict_path)
            self.assertEqual(initial_rows, [])

            conflict_path.write_text(
                "conflict_id,claim_id,submission_id,submitted_by,submitted_role,submitted_model,submitted_at,"
                "accepted_state_hash,accepted_value_snapshot,accepted_resolution_status,accepted_evidence_tier,"
                "accepted_source_fingerprint,proposed_value,proposed_resolution_status,proposed_evidence_tier,"
                "proposed_confidence,proposed_estimate_rationale,proposed_research_note,proposed_source_1_title,"
                "proposed_source_1_url,proposed_source_1_publisher,proposed_source_1_published_date,"
                "proposed_source_1_accessed_date,proposed_source_1_excerpt,proposed_source_2_title,"
                "proposed_source_2_url,proposed_source_2_publisher,proposed_source_2_published_date,"
                "proposed_source_2_accessed_date,proposed_source_2_excerpt,proposed_source_3_title,"
                "proposed_source_3_url,proposed_source_3_publisher,proposed_source_3_published_date,"
                "proposed_source_3_accessed_date,proposed_source_3_excerpt,change_type,disagreement_summary,"
                "corroborates_submission_id,review_status,decision_action,decision_by,decision_at,decision_notes\n"
                "conflict-1,claim-1,sub-1,GPT,researcher,gpt-5.4,2026-03-31,,,,,,,,,,,,,,,,,,,,,,,,,,value_correction,Example disagreement,,pending,,,,\n",
                encoding="utf-8",
            )
            ensure_reference_research_conflict_csv(conflict_path)
            preserved_rows = load_reference_research_conflict_rows(conflict_path)
            self.assertEqual(len(preserved_rows), 1)
            self.assertEqual(preserved_rows[0]["conflict_id"], "conflict-1")

    def test_prompt_writer_outputs_four_file_workflow_prompt(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            prompt_path = Path(temp_dir) / "reference_research_multi_agent_prompt.txt"
            created = write_reference_research_prompt(output_path=prompt_path)
            self.assertEqual(created, prompt_path)
            contents = prompt_path.read_text(encoding="utf-8")
            self.assertEqual(contents, REFERENCE_RESEARCH_PROMPT)
            self.assertIn("Four-file workflow rules:", contents)
            self.assertIn("Do not edit `reference_research_claims_resolved.csv` directly.", contents)
            self.assertIn("The final file to upload back into the app is `reference_research_claims_resolved.csv` after reconciliation.", contents)

    def test_export_reference_research_writes_full_multi_agent_package(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            original_db_path = database_module.DB_PATH
            try:
                database_module.DB_PATH = Path(temp_dir) / "planner.db"
                xlsx_path = Path(temp_dir) / "reference_research.xlsx"
                csv_path = Path(temp_dir) / "reference_research_claims.csv"
                conflicts_path = Path(temp_dir) / "reference_research_conflicts.csv"
                resolved_path = Path(temp_dir) / "reference_research_claims_resolved.csv"
                review_queue_path = Path(temp_dir) / "reference_research_review_queue.csv"
                prompt_path = Path(temp_dir) / "reference_research_multi_agent_prompt.txt"

                export_reference_research(
                    xlsx_path=xlsx_path,
                    csv_path=csv_path,
                    conflicts_path=conflicts_path,
                    resolved_path=resolved_path,
                    review_queue_path=review_queue_path,
                    prompt_path=prompt_path,
                )

                self.assertTrue(xlsx_path.exists())
                self.assertTrue(csv_path.exists())
                self.assertTrue(conflicts_path.exists())
                self.assertTrue(resolved_path.exists())
                self.assertTrue(review_queue_path.exists())
                self.assertTrue(prompt_path.exists())

                accepted_rows = load_reference_research_rows(csv_path)
                resolved_rows = load_reference_research_rows(resolved_path)
                review_queue_rows = load_reference_research_conflict_rows(review_queue_path)
                conflict_rows = load_reference_research_conflict_rows(conflicts_path)

                self.assertTrue(accepted_rows)
                self.assertEqual(len(accepted_rows), len(resolved_rows))
                self.assertEqual(conflict_rows, [])
                self.assertEqual(review_queue_rows, [])
                self.assertIn("reference_research_claims.csv", prompt_path.read_text(encoding="utf-8"))
            finally:
                database_module.DB_PATH = original_db_path

    def test_reconcile_applies_only_accepted_apply_to_claim_conflicts(self) -> None:
        accepted_rows = [
            {
                "claim_id": "claim-1",
                "current_value": "100",
                "proposed_value": "",
                "research_note": "",
                "resolution_status": "public_verified",
                "evidence_tier": "public",
                "confidence": "",
                "estimate_rationale": "",
                "source_1_title": "Old source",
                "source_1_url": "https://example.com/old",
                "source_1_publisher": "Example",
                "source_1_published_date": "",
                "source_1_accessed_date": "",
                "source_1_excerpt": "Old excerpt",
                "source_2_title": "",
                "source_2_url": "",
                "source_2_publisher": "",
                "source_2_published_date": "",
                "source_2_accessed_date": "",
                "source_2_excerpt": "",
                "source_3_title": "",
                "source_3_url": "",
                "source_3_publisher": "",
                "source_3_published_date": "",
                "source_3_accessed_date": "",
                "source_3_excerpt": "",
            }
        ]
        conflict_rows = [
            {
                "conflict_id": "conflict-1",
                "claim_id": "claim-1",
                "submission_id": "sub-1",
                "submitted_by": "Gemini",
                "submitted_role": "researcher",
                "submitted_model": "gemini",
                "submitted_at": "2026-03-31",
                "accepted_state_hash": accepted_state_hash(accepted_rows[0]),
                "accepted_value_snapshot": "100",
                "accepted_resolution_status": "public_verified",
                "accepted_evidence_tier": "public",
                "accepted_source_fingerprint": accepted_source_fingerprint(accepted_rows[0]),
                "proposed_value": "125",
                "proposed_resolution_status": "official_verified",
                "proposed_evidence_tier": "official",
                "proposed_confidence": "",
                "proposed_estimate_rationale": "",
                "proposed_research_note": "Official page corrects the value.",
                "proposed_source_1_title": "Official source",
                "proposed_source_1_url": "https://example.com/official",
                "proposed_source_1_publisher": "Official",
                "proposed_source_1_published_date": "2026-03-01",
                "proposed_source_1_accessed_date": "2026-03-31",
                "proposed_source_1_excerpt": "Updated value is 125.",
                "proposed_source_2_title": "",
                "proposed_source_2_url": "",
                "proposed_source_2_publisher": "",
                "proposed_source_2_published_date": "",
                "proposed_source_2_accessed_date": "",
                "proposed_source_2_excerpt": "",
                "proposed_source_3_title": "",
                "proposed_source_3_url": "",
                "proposed_source_3_publisher": "",
                "proposed_source_3_published_date": "",
                "proposed_source_3_accessed_date": "",
                "proposed_source_3_excerpt": "",
                "change_type": "value_correction",
                "disagreement_summary": "Official source supersedes earlier public source.",
                "corroborates_submission_id": "",
                "review_status": "accepted",
                "decision_action": "apply_to_claim",
                "decision_by": "reviewer",
                "decision_at": "2026-03-31",
                "decision_notes": "Apply official correction.",
            },
            {
                "conflict_id": "conflict-2",
                "claim_id": "claim-1",
                "submission_id": "sub-2",
                "submitted_by": "Claude",
                "submitted_role": "researcher",
                "submitted_model": "claude",
                "submitted_at": "2026-04-01",
                "accepted_state_hash": accepted_state_hash(accepted_rows[0]),
                "accepted_value_snapshot": "100",
                "accepted_resolution_status": "public_verified",
                "accepted_evidence_tier": "public",
                "accepted_source_fingerprint": accepted_source_fingerprint(accepted_rows[0]),
                "proposed_value": "140",
                "proposed_resolution_status": "public_verified",
                "proposed_evidence_tier": "public",
                "proposed_confidence": "",
                "proposed_estimate_rationale": "",
                "proposed_research_note": "Needs more review.",
                "proposed_source_1_title": "Another source",
                "proposed_source_1_url": "https://example.com/another",
                "proposed_source_1_publisher": "Another",
                "proposed_source_1_published_date": "",
                "proposed_source_1_accessed_date": "",
                "proposed_source_1_excerpt": "",
                "proposed_source_2_title": "",
                "proposed_source_2_url": "",
                "proposed_source_2_publisher": "",
                "proposed_source_2_published_date": "",
                "proposed_source_2_accessed_date": "",
                "proposed_source_2_excerpt": "",
                "proposed_source_3_title": "",
                "proposed_source_3_url": "",
                "proposed_source_3_publisher": "",
                "proposed_source_3_published_date": "",
                "proposed_source_3_accessed_date": "",
                "proposed_source_3_excerpt": "",
                "change_type": "value_correction",
                "disagreement_summary": "Competing correction.",
                "corroborates_submission_id": "sub-1",
                "review_status": "pending",
                "decision_action": "",
                "decision_by": "",
                "decision_at": "",
                "decision_notes": "",
            },
        ]

        reconciliation = reconcile_reference_research_rows(
            accepted_rows=accepted_rows,
            conflict_rows=conflict_rows,
        )
        resolved = reconciliation["resolved_rows"][0]
        self.assertEqual(resolved["proposed_value"], "125")
        self.assertEqual(resolved["resolution_status"], "official_verified")
        self.assertEqual(resolved["source_1_title"], "Official source")
        self.assertEqual(len(reconciliation["applied_conflicts"]), 1)
        self.assertEqual(len(reconciliation["review_queue_rows"]), 1)
        self.assertEqual(reconciliation["review_queue_rows"][0]["corroborates_submission_id"], "sub-1")

    def test_reconcile_queues_stale_conflicts_instead_of_applying(self) -> None:
        accepted_rows = [
            {
                "claim_id": "claim-1",
                "current_value": "100",
                "proposed_value": "110",
                "research_note": "Current accepted state changed.",
                "resolution_status": "official_verified",
                "evidence_tier": "official",
                "confidence": "",
                "estimate_rationale": "",
                "source_1_title": "Current source",
                "source_1_url": "https://example.com/current",
                "source_1_publisher": "Current",
                "source_1_published_date": "",
                "source_1_accessed_date": "",
                "source_1_excerpt": "",
                "source_2_title": "",
                "source_2_url": "",
                "source_2_publisher": "",
                "source_2_published_date": "",
                "source_2_accessed_date": "",
                "source_2_excerpt": "",
                "source_3_title": "",
                "source_3_url": "",
                "source_3_publisher": "",
                "source_3_published_date": "",
                "source_3_accessed_date": "",
                "source_3_excerpt": "",
            }
        ]
        conflict_rows = [
            {
                "conflict_id": "conflict-1",
                "claim_id": "claim-1",
                "submission_id": "sub-1",
                "submitted_by": "GPT",
                "submitted_role": "researcher",
                "submitted_model": "gpt-5.4",
                "submitted_at": "2026-03-31",
                "accepted_state_hash": "stalehash",
                "accepted_value_snapshot": "100",
                "accepted_resolution_status": "public_verified",
                "accepted_evidence_tier": "public",
                "accepted_source_fingerprint": "oldsources",
                "proposed_value": "125",
                "proposed_resolution_status": "official_verified",
                "proposed_evidence_tier": "official",
                "proposed_confidence": "",
                "proposed_estimate_rationale": "",
                "proposed_research_note": "Apply stale correction.",
                "proposed_source_1_title": "Official source",
                "proposed_source_1_url": "https://example.com/official",
                "proposed_source_1_publisher": "Official",
                "proposed_source_1_published_date": "",
                "proposed_source_1_accessed_date": "",
                "proposed_source_1_excerpt": "",
                "proposed_source_2_title": "",
                "proposed_source_2_url": "",
                "proposed_source_2_publisher": "",
                "proposed_source_2_published_date": "",
                "proposed_source_2_accessed_date": "",
                "proposed_source_2_excerpt": "",
                "proposed_source_3_title": "",
                "proposed_source_3_url": "",
                "proposed_source_3_publisher": "",
                "proposed_source_3_published_date": "",
                "proposed_source_3_accessed_date": "",
                "proposed_source_3_excerpt": "",
                "change_type": "value_correction",
                "disagreement_summary": "Stale accepted-state snapshot.",
                "corroborates_submission_id": "",
                "review_status": "accepted",
                "decision_action": "apply_to_claim",
                "decision_by": "reviewer",
                "decision_at": "2026-04-01",
                "decision_notes": "",
            }
        ]

        reconciliation = reconcile_reference_research_rows(
            accepted_rows=accepted_rows,
            conflict_rows=conflict_rows,
        )
        resolved = reconciliation["resolved_rows"][0]
        self.assertEqual(resolved["proposed_value"], "110")
        self.assertEqual(len(reconciliation["applied_conflicts"]), 0)
        self.assertEqual(len(reconciliation["review_queue_rows"]), 1)
        self.assertEqual(reconciliation["review_queue_rows"][0]["queue_reason"], "accepted_state_hash_mismatch")

    def test_reconcile_resolved_csv_imports_without_unresolved_conflicts(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            original_db_path = database_module.DB_PATH
            conn = None
            try:
                database_module.DB_PATH = Path(temp_dir) / "planner.db"
                initialize_database()
                conn = get_connection()
                bootstrap = fetch_bootstrap(conn)
                workbook_path, accepted_rows = write_reference_research_workbook(
                    bootstrap=bootstrap,
                    output_path=Path(temp_dir) / "accepted.xlsx",
                )
                _ = workbook_path
                claim = self._find_claim(bootstrap, "programs", "STAN-CS-PHD", "websiteUrl")
                accepted_row = next(row for row in accepted_rows if row["claim_id"] == claim["id"])
                conflict_rows = [
                    {
                        "conflict_id": "conflict-1",
                        "claim_id": claim["id"],
                        "submission_id": "sub-1",
                        "submitted_by": "Gemini",
                        "submitted_role": "researcher",
                        "submitted_model": "gemini",
                        "submitted_at": "2026-03-31",
                        "accepted_state_hash": accepted_state_hash(accepted_row),
                        "accepted_value_snapshot": accepted_row["current_value"],
                        "accepted_resolution_status": accepted_row["resolution_status"],
                        "accepted_evidence_tier": accepted_row["evidence_tier"],
                        "accepted_source_fingerprint": accepted_source_fingerprint(accepted_row),
                        "proposed_value": "https://cs.stanford.edu/admissions/phd-overview",
                        "proposed_resolution_status": "official_verified",
                        "proposed_evidence_tier": "official",
                        "proposed_confidence": "",
                        "proposed_estimate_rationale": "",
                        "proposed_research_note": "Reviewer accepted updated Stanford overview URL.",
                        "proposed_source_1_title": "Stanford CS overview",
                        "proposed_source_1_url": "https://example.com/stanford-overview",
                        "proposed_source_1_publisher": "Stanford",
                        "proposed_source_1_published_date": "",
                        "proposed_source_1_accessed_date": "",
                        "proposed_source_1_excerpt": "",
                        "proposed_source_2_title": "",
                        "proposed_source_2_url": "",
                        "proposed_source_2_publisher": "",
                        "proposed_source_2_published_date": "",
                        "proposed_source_2_accessed_date": "",
                        "proposed_source_2_excerpt": "",
                        "proposed_source_3_title": "",
                        "proposed_source_3_url": "",
                        "proposed_source_3_publisher": "",
                        "proposed_source_3_published_date": "",
                        "proposed_source_3_accessed_date": "",
                        "proposed_source_3_excerpt": "",
                        "change_type": "value_correction",
                        "disagreement_summary": "Updated website URL.",
                        "corroborates_submission_id": "",
                        "review_status": "accepted",
                        "decision_action": "apply_to_claim",
                        "decision_by": "reviewer",
                        "decision_at": "2026-03-31",
                        "decision_notes": "",
                    },
                    {
                        "conflict_id": "conflict-2",
                        "claim_id": claim["id"],
                        "submission_id": "sub-2",
                        "submitted_by": "Claude",
                        "submitted_role": "researcher",
                        "submitted_model": "claude",
                        "submitted_at": "2026-04-01",
                        "accepted_state_hash": accepted_state_hash(accepted_row),
                        "accepted_value_snapshot": accepted_row["current_value"],
                        "accepted_resolution_status": accepted_row["resolution_status"],
                        "accepted_evidence_tier": accepted_row["evidence_tier"],
                        "accepted_source_fingerprint": accepted_source_fingerprint(accepted_row),
                        "proposed_value": "https://cs.stanford.edu/phd",
                        "proposed_resolution_status": "public_verified",
                        "proposed_evidence_tier": "public",
                        "proposed_confidence": "",
                        "proposed_estimate_rationale": "",
                        "proposed_research_note": "Still pending.",
                        "proposed_source_1_title": "Pending source",
                        "proposed_source_1_url": "https://example.com/pending",
                        "proposed_source_1_publisher": "Example",
                        "proposed_source_1_published_date": "",
                        "proposed_source_1_accessed_date": "",
                        "proposed_source_1_excerpt": "",
                        "proposed_source_2_title": "",
                        "proposed_source_2_url": "",
                        "proposed_source_2_publisher": "",
                        "proposed_source_2_published_date": "",
                        "proposed_source_2_accessed_date": "",
                        "proposed_source_2_excerpt": "",
                        "proposed_source_3_title": "",
                        "proposed_source_3_url": "",
                        "proposed_source_3_publisher": "",
                        "proposed_source_3_published_date": "",
                        "proposed_source_3_accessed_date": "",
                        "proposed_source_3_excerpt": "",
                        "change_type": "value_correction",
                        "disagreement_summary": "Unresolved alternative.",
                        "corroborates_submission_id": "sub-1",
                        "review_status": "pending",
                        "decision_action": "",
                        "decision_by": "",
                        "decision_at": "",
                        "decision_notes": "",
                    },
                ]
                reconciliation = reconcile_reference_research_rows(
                    accepted_rows=accepted_rows,
                    conflict_rows=conflict_rows,
                )
                bundle = build_research_import_bundle(
                    rows=reconciliation["resolved_rows"],
                    bootstrap=bootstrap,
                )
                replace_research_import_bundle(
                    conn,
                    value_overrides=bundle["value_overrides"],
                    claim_overrides=bundle["claim_overrides"],
                    documents=bundle["documents"],
                    claim_documents=bundle["claim_documents"],
                )
                updated_bootstrap = fetch_bootstrap(conn)
                updated_claim = self._find_claim(updated_bootstrap, "programs", "STAN-CS-PHD", "websiteUrl")
                self.assertEqual(updated_claim["currentValue"], "https://cs.stanford.edu/admissions/phd-overview")
                self.assertEqual(updated_claim["verificationStatus"], "official_verified")
                self.assertGreater(updated_claim["sourceCount"], 0)
                self.assertEqual(len(reconciliation["review_queue_rows"]), 1)
            finally:
                if conn is not None:
                    conn.close()
                database_module.DB_PATH = original_db_path

    def test_override_validation_only_allows_declared_numeric_fields(self) -> None:
        self.assertIn("stipendAnnual", editable_reference_fields()["programs"])
        self.assertNotIn("id", editable_reference_fields()["programs"])

        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            CREATE TABLE reference_overrides (
                domain TEXT NOT NULL,
                record_id TEXT NOT NULL,
                field TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'global',
                value REAL NOT NULL,
                reason TEXT DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (domain, record_id, field, scope)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE reference_tables (
                category TEXT NOT NULL,
                item_id TEXT NOT NULL,
                label TEXT NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (category, item_id)
            )
            """
        )
        conn.executemany(
            "INSERT INTO reference_tables(category, item_id, label, payload) VALUES (?, ?, ?, ?)",
            [
                (domain, item["id"], item.get("label", item["id"]), json.dumps(item))
                for domain, items in REFERENCE_DOMAINS.items()
                for item in items
            ],
        )
        save_reference_override(conn, {"domain": "programs", "recordId": "STAN-CS-PHD", "field": "stipendAnnual", "value": 58000})
        saved = conn.execute("SELECT value FROM reference_overrides").fetchone()
        self.assertEqual(saved[0], 58000)
        with self.assertRaises(ValueError):
            save_reference_override(conn, {"domain": "programs", "recordId": "STAN-CS-PHD", "field": "id", "value": 1})
        conn.close()

    def test_military_promotion_override_validation_rejects_invalid_grade(self) -> None:
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            CREATE TABLE reference_overrides (
                domain TEXT NOT NULL,
                record_id TEXT NOT NULL,
                field TEXT NOT NULL,
                scope TEXT NOT NULL DEFAULT 'global',
                value REAL NOT NULL,
                reason TEXT DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (domain, record_id, field, scope)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE reference_tables (
                category TEXT NOT NULL,
                item_id TEXT NOT NULL,
                label TEXT NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (category, item_id)
            )
            """
        )
        conn.executemany(
            "INSERT INTO reference_tables(category, item_id, label, payload) VALUES (?, ?, ?, ?)",
            [
                (domain, item["id"], item.get("label", item["id"]), json.dumps(item))
                for domain, items in REFERENCE_DOMAINS.items()
                for item in items
            ],
        )
        save_reference_override(conn, {"domain": "military_promotion_schedule", "recordId": "promotion_slot_1", "field": "promotionYear", "value": 2030})
        save_reference_override(conn, {"domain": "military_promotion_schedule", "recordId": "promotion_slot_1", "field": "targetPayGradeNumeric", "value": 8})
        save_reference_override(conn, {"domain": "military_promotion_schedule", "recordId": "promotion_slot_1", "field": "enabledFlag", "value": 1})
        save_reference_override(conn, {"domain": "military_promotion_schedule", "recordId": "promotion_slot_2", "field": "promotionYear", "value": 2033})
        save_reference_override(conn, {"domain": "military_promotion_schedule", "recordId": "promotion_slot_2", "field": "targetPayGradeNumeric", "value": 10})
        with self.assertRaisesRegex(ValueError, "cannot go beyond E-9"):
            save_reference_override(
                conn,
                {
                    "domain": "military_promotion_schedule",
                    "recordId": "promotion_slot_2",
                    "field": "enabledFlag",
                    "value": 1,
                },
            )
        conn.close()

    def test_auto_source_registry_creates_field_level_claims_with_placeholder_docs(self) -> None:
        claims, documents, claim_documents = build_auto_source_registry(REFERENCE_DOMAINS)
        base_salary_claim = next(
            item
            for item in claims
            if item["targetDomain"] == "career_comp_profiles"
            and item["targetRecordId"] == "GENERIC_IC"
            and item["targetField"] == "baseSalary"
        )
        self.assertEqual(base_salary_claim["placeholderStatus"], "record_level_placeholder")
        self.assertTrue(any(link["claimId"] == base_salary_claim["id"] for link in claim_documents))
        self.assertTrue(any(document["title"] == "Planner seed default" for document in documents))

    def test_auto_source_registry_covers_program_stipend_claims(self) -> None:
        claims, _, _ = build_auto_source_registry(REFERENCE_DOMAINS)
        stipend_claim = next(
            item
            for item in claims
            if item["targetDomain"] == "programs"
            and item["targetRecordId"] == "STAN-CS-PHD"
            and item["targetField"] == "stipendAnnual"
        )
        self.assertEqual(stipend_claim["fieldLabel"], "Stipend")
        self.assertIn("Stanford", stipend_claim["friendlyTargetLabel"])

    def test_manual_cashflow_seed_uses_nested_workbook_sections(self) -> None:
        self.assertIn("income", MANUAL_CASHFLOW_SEED)
        self.assertIn("expenses", MANUAL_CASHFLOW_SEED)
        self.assertTrue(MANUAL_CASHFLOW_SEED["income"])
        self.assertTrue(MANUAL_CASHFLOW_SEED["expenses"])

        income_section = MANUAL_CASHFLOW_SEED["income"][0]
        expense_section = next(item for item in MANUAL_CASHFLOW_SEED["expenses"] if item["id"] == "leisure_hobbies_entertainment")
        self.assertIn("items", income_section)
        self.assertEqual(income_section["label"], "Service Member Income")
        self.assertTrue(any(item["id"] == "monthly_base_pay" for item in income_section["items"]))
        self.assertTrue(any(item["id"] == "streaming_services" for item in expense_section["items"]))
        service_member_base = next(item for item in income_section["items"] if item["id"] == "monthly_base_pay")
        spouse_income = next(item for item in next(section for section in MANUAL_CASHFLOW_SEED["income"] if section["id"] == "spouse_income")["items"] if item["id"] == "monthly_pay")
        debt_section = next(section for section in MANUAL_CASHFLOW_SEED["debts"] if section["id"] == "housing_creditors")
        debt_item = next(item for item in debt_section["items"] if item["id"] == "rent_primary_home_mortgage")
        self.assertEqual(service_member_base["entryMode"], "reference_backed_hidden")
        self.assertEqual(spouse_income["entryMode"], "manual_only")
        self.assertEqual(debt_section["displayMode"], "visible_when_empty")
        self.assertEqual(debt_item["displayMode"], "show_only_if_used")

    def test_flatten_manual_finance_group_supports_nested_sections(self) -> None:
        flattened = flatten_manual_finance_group(MANUAL_CASHFLOW_SEED["expenses"])
        streaming = next(item for item in flattened if item["id"] == "streaming_services")
        self.assertEqual(streaming["sectionId"], "leisure_hobbies_entertainment")
        self.assertEqual(streaming["sectionLabel"], "Leisure / Hobbies / Entertainment")
        self.assertIn("amountMonthly", streaming)

    def test_normalize_manual_finance_payload_preserves_exact_matches_and_custom_rows(self) -> None:
        payload = copy.deepcopy(MANUAL_CASHFLOW_SEED)
        savings = next(section for section in payload["assets"] if section["id"] == "savings")
        checking = next(item for item in savings["items"] if item["id"] == "checking_accounts")
        checking["amount"] = 2200
        checking["notes"] = "Combined checking."
        housing = next(section for section in payload["expenses"] if section["id"] == "housing")
        housing["items"].append(
            {
                "id": "custom_housing_total",
                "label": "Housing Carryover",
                "notes": "Broad historical total.",
                "amountMonthly": 500,
                "isCustom": True,
                "sortOrder": 99,
                "sourceRefId": None,
            }
        )

        normalized = normalize_manual_finance_payload(payload)
        normalized_savings = next(section for section in normalized["assets"] if section["id"] == "savings")
        normalized_checking = next(item for item in normalized_savings["items"] if item["id"] == "checking_accounts")
        self.assertEqual(normalized_checking["amount"], 2200)
        self.assertEqual(normalized_checking["notes"], "Combined checking.")
        normalized_housing = next(section for section in normalized["expenses"] if section["id"] == "housing")
        self.assertTrue(any(item["id"] == "custom_housing_total" and item["amountMonthly"] == 500 for item in normalized_housing["items"]))
        self.assertEqual(normalized_housing["displayMode"], "visible_when_empty")

    def test_legacy_manual_migration_keeps_broad_expense_totals_as_carried_over_rows(self) -> None:
        migrated = migrate_legacy_manual_inputs(LEGACY_MANUAL_BASELINE)
        housing = next(section for section in migrated["expenses"] if section["id"] == "housing")
        carried_over = next(item for item in housing["items"] if item["id"] == "migrated_expense_housing")
        self.assertTrue(carried_over["isCustom"])
        self.assertEqual(carried_over["amountMonthly"], 1400)

        savings = next(section for section in migrated["assets"] if section["id"] == "savings")
        checking = next(item for item in savings["items"] if item["id"] == "checking_accounts")
        self.assertEqual(checking["amount"], 3000)

    def test_bootstrap_keeps_legacy_template_summaries(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            original_db_path = database_module.DB_PATH
            conn = None
            try:
                database_module.DB_PATH = Path(temp_dir) / "planner.db"
                initialize_database()
                conn = get_connection()
                bootstrap = fetch_bootstrap(conn)
                scenario_path_a = next(item for item in bootstrap["scenarios"] if item["id"] == "scenario_path_a")
                self.assertEqual(scenario_path_a["pathTemplateId"], "PATH_A")
                self.assertEqual(scenario_path_a["routeSummary"], "Stay Military -> Retire -> PhD -> Research Scientist")
            finally:
                if conn is not None:
                    conn.close()
                database_module.DB_PATH = original_db_path

    def test_save_scenario_coerces_path_custom_on_load_and_preserves_raw_timeline(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            original_db_path = database_module.DB_PATH
            conn = None
            try:
                database_module.DB_PATH = Path(temp_dir) / "planner.db"
                initialize_database()
                conn = get_connection()
                custom_scenario = {
                    "id": "scenario_custom_roundtrip",
                    "name": "Custom Roundtrip",
                    "displayName": "Custom Roundtrip",
                    "pathTemplateId": "PATH_CUSTOM",
                    "pathTimeline": {
                        "version": 1,
                        "serviceExit": {"type": "separation", "year": 2027},
                        "blocks": [
                            {"id": "tech_1", "type": "tech_career", "startYear": 2028},
                            {"id": "grad_1", "type": "grad_school", "startYear": 2031},
                        ],
                    },
                    "enabled": True,
                    "notes": "",
                    "colorToken": "plum",
                    "isLoaded": True,
                    "displayOrder": 3,
                    "selectedCompanyId": "GENERIC_IC",
                    "selectedEmployerId": None,
                    "selectedVaRatingId": "30",
                    "selectedPhdProgramId": "STAN-CS-PHD",
                    "useVa": True,
                    "useGiBill": True,
                    "overrides": {},
                }
                save_scenario(conn, custom_scenario)
                bootstrap = fetch_bootstrap(conn)
                saved = next(item for item in bootstrap["scenarios"] if item["id"] == "scenario_custom_roundtrip")
                self.assertEqual(saved["pathTemplateId"], "PATH_C")
                self.assertEqual(saved["routeSummary"], "Separate -> Gap Year -> PhD -> Research Scientist")

                raw_row = conn.execute(
                    "SELECT path_timeline_json FROM scenario_forks WHERE scenario_id = ?",
                    ("scenario_custom_roundtrip",),
                ).fetchone()
                self.assertIsNotNone(raw_row)
                raw_timeline = json.loads(raw_row["path_timeline_json"])
                self.assertEqual(raw_timeline["serviceExit"]["type"], "separation")
                self.assertEqual(raw_timeline["blocks"][0]["type"], "tech_career")
            finally:
                if conn is not None:
                    conn.close()
                database_module.DB_PATH = original_db_path


if __name__ == "__main__":
    unittest.main()
