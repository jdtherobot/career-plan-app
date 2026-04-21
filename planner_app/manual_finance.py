from __future__ import annotations

import copy
from typing import Any


MONTHLY_BUCKETS = {"income", "expenses"}
BALANCE_BUCKETS = {"assets", "debts"}


MANUAL_FINANCE_TEMPLATE: dict[str, list[dict[str, Any]]] = {
    "income": [
        {
            "id": "service_member_income",
            "label": "Service Member Income",
            "items": [
                ("monthly_base_pay", "Monthly Base Pay"),
                ("bah_housing", "BAH (Housing)"),
                ("bas", "BAS"),
                ("oha", "OHA"),
                ("cola", "COLA"),
                ("special_pay", "Special Pay"),
                ("hazard_duty_pay", "Hazard Duty Pay"),
                ("flight_duty_pay", "Flight Duty Pay"),
                ("foreign_language_pay", "Foreign Language Pay"),
                ("family_separation_allowance", "Family Separation Allowance"),
                ("other_take_home_pay", "Other Take Home Pay"),
                ("military_retirement_pay", "Military Retirement Pay"),
                ("rental_home_income", "Rental Home Income"),
                ("va_benefits", "VA Benefits"),
                ("child_support_alimony_income", "Child Support / Alimony"),
            ],
        },
        {
            "id": "service_member_deductions",
            "label": "Service Member Deductions",
            "items": [
                ("fitw", "FITW (Federal Income Tax Withheld)"),
                ("fica_social_security", "FICA (Social Security)"),
                ("fica_medicare", "FICA (Medicare)"),
                ("state_income_tax", "State Income Tax"),
                ("afrh", "AFRH (Armed Forces Retirement Home)"),
                ("sgli_tsgli", "SGLI and T-SGLI"),
                ("sgli_family_spouse", "SGLI Family / Spouse"),
                ("tsp", "TSP"),
                ("sdp", "SDP"),
                ("partial_pay", "Partial Pay"),
                ("advance_payments", "Advance Payments"),
                ("montgomery_gi_bill", "Montgomery GI Bill"),
                ("child_support_alimony_paid", "Child Support / Alimony Paid"),
                ("k401", "401K"),
            ],
        },
        {
            "id": "spouse_income",
            "label": "Spouse Income",
            "items": [
                ("monthly_pay", "Monthly Pay"),
                ("spouse_bah_housing", "BAH (Housing)"),
                ("spouse_bas", "BAS"),
                ("spouse_oha", "OHA"),
                ("spouse_cola", "COLA"),
                ("spouse_special_pay", "Special Pay"),
                ("spouse_hazard_duty_pay", "Hazard Duty Pay"),
                ("spouse_flight_duty_pay", "Flight Duty Pay"),
                ("spouse_foreign_language_pay", "Foreign Language Pay"),
                ("spouse_family_separation_allowance", "Family Separation Allowance"),
                ("spouse_military_retirement_pay", "Military Retirement Pay"),
                ("spouse_rental_home_income", "Rental Home Income"),
                ("spouse_va_benefits", "VA Benefits"),
                ("spouse_child_support_alimony_income", "Child Support / Alimony"),
                ("other_take_home_pay_second_job", "Other Take Home Pay / Second Job"),
            ],
        },
        {
            "id": "spouse_deductions",
            "label": "Spouse Deductions",
            "items": [
                ("spouse_fitw", "FITW (Federal Income Tax Withheld)"),
                ("spouse_fica_social_security", "FICA (Social Security)"),
                ("spouse_fica_medicare", "FICA (Medicare)"),
                ("spouse_state_income_tax", "State Income Tax"),
                ("spouse_afrh", "AFRH (Armed Forces Retirement Home)"),
                ("spouse_sgli_tsgli", "SGLI and T-SGLI"),
                ("spouse_sgli_family_spouse", "SGLI Family / Spouse"),
                ("spouse_tsp", "TSP"),
                ("spouse_sdp", "SDP"),
                ("spouse_partial_pay", "Partial Pay"),
                ("spouse_advance_payments", "Advance Payments"),
                ("spouse_montgomery_gi_bill", "Montgomery GI Bill"),
                ("spouse_child_support_alimony_paid", "Child Support / Alimony Paid"),
            ],
        },
    ],
    "expenses": [
        {
            "id": "housing",
            "label": "Housing",
            "items": [
                ("fees_hoa_pool", "Fees / HOA Fees / Pool Fees"),
                ("furniture_decorations", "Furniture / Decorations"),
                ("home_maintenance_repairs", "Home Maintenance / Repairs"),
                ("taxes", "Taxes"),
                ("rent", "Rent"),
                ("renters_insurance", "Renters Insurance"),
            ],
        },
        {
            "id": "utilities",
            "label": "Utilities",
            "items": [
                ("cable_satellite", "Cable / Satellite"),
                ("cell_phone_landline", "Cell Phone / Phone Cards / Landline"),
                ("internet", "Internet"),
                ("electricity", "Electricity"),
                ("natural_gas_propane", "Natural Gas / Propane"),
                ("garbage", "Garbage"),
                ("water_sewage", "Water / Sewage"),
            ],
        },
        {
            "id": "transportation",
            "label": "Transportation",
            "items": [
                ("gasoline", "Gasoline"),
                ("parking", "Parking"),
                ("taxes_registration_licensing", "Taxes / Registration / Licensing"),
                ("taxi_bus_rideshare_train", "Taxi / Bus / Uber / Lyft / Train"),
                ("vehicle_maintenance_repairs", "Vehicle Maintenance / Repairs"),
            ],
        },
        {
            "id": "food",
            "label": "Food",
            "items": [
                ("dining_out", "Dining Out"),
                ("groceries", "Groceries"),
                ("lunches", "Lunches"),
                ("vending_machines", "Vending Machines"),
            ],
        },
        {
            "id": "insurance",
            "label": "Insurance",
            "items": [
                ("auto_insurance", "Auto Insurance"),
                ("dental_insurance", "Dental Insurance"),
                ("health_insurance", "Health Insurance"),
                ("life_insurance", "Life Insurance"),
                ("renters_home_insurance", "Renters / Home Insurance"),
            ],
        },
        {
            "id": "healthcare",
            "label": "Healthcare",
            "items": [
                ("dental", "Dental"),
                ("doctor_hospital_urgent_care", "Doctor / Hospital / Urgent Care"),
                ("eye_care", "Eye Care"),
                ("prescriptions_medications", "Prescriptions / Medications"),
            ],
        },
        {
            "id": "clothing",
            "label": "Clothing",
            "items": [
                ("laundry_dry_cleaning", "Laundry / Dry Cleaning"),
                ("new_clothing_purchase", "New Clothing Purchase"),
            ],
        },
        {
            "id": "child_care",
            "label": "Child Care",
            "items": [
                ("allowance", "Allowance"),
                ("child_support", "Child Support"),
                ("day_care", "Day Care"),
                ("diapers_wipes_etc", "Diapers / Wipes / Etc."),
            ],
        },
        {
            "id": "pet_care",
            "label": "Pet Care",
            "items": [
                ("pet_food_supplies", "Food / Supplies"),
                ("pet_prescriptions_medications", "Prescriptions / Medications"),
                ("vet_grooming_boarding", "Veterinarian / Grooming / Boarding"),
            ],
        },
        {
            "id": "personal",
            "label": "Personal",
            "items": [
                ("beauty_barber_salon", "Beauty Shop / Barber Shop / Salon"),
                ("health_club_dues", "Health Club / Organizational Dues"),
                ("nails_massage_grooming", "Nails / Massage / Personal Grooming"),
                ("personal_spending_fund", "Personal Spending Fund"),
                ("personal_supplies", "Personal Supplies"),
                ("tobacco_alcohol", "Tobacco / Alcohol"),
            ],
        },
        {
            "id": "education",
            "label": "Education",
            "items": [
                ("books_supplies", "Books / Supplies"),
                ("educational_materials", "Educational Materials"),
                ("lessons_tutor", "Lessons / Tutor"),
            ],
        },
        {
            "id": "leisure_hobbies_entertainment",
            "label": "Leisure / Hobbies / Entertainment",
            "items": [
                ("athletic_sporting_events", "Athletic Events / Sporting Events"),
                ("books_magazines", "Books / Magazines"),
                ("computer_products", "Computer Products"),
                ("concerts_theater", "Concerts / Theater"),
                ("dvds_cds", "DVDs & CDs"),
                ("movie_music_downloads", "Movie / Music Downloads"),
                ("streaming_services", "Streaming Services"),
                ("toys_games", "Toys / Games"),
                ("travel_lodging", "Travel / Lodging"),
                ("netflix_crunchyroll_spotify", "Netflix, Crunchyroll, Spotify"),
                ("chatgpt", "CHATGPT"),
                ("audible", "AUDIBLE"),
                ("claude", "Claude"),
            ],
        },
        {
            "id": "contributions",
            "label": "Contributions",
            "items": [
                ("charities", "Charities"),
                ("religious_donations", "Religious Donations"),
            ],
        },
        {
            "id": "gifts",
            "label": "Gifts",
            "items": [
                ("holiday_birthday_anniversary", "Holiday / Birthday / Anniversary"),
            ],
        },
        {
            "id": "miscellaneous",
            "label": "Miscellaneous",
            "items": [
                ("atm_bank_fees", "ATM Fees / Bank Fees"),
                ("deployment_tad_expenses", "Deployment / TAD Expenses"),
                ("membership_fees", "Membership Fees"),
            ],
        },
    ],
    "assets": [
        {
            "id": "savings",
            "label": "Savings",
            "items": [
                ("cash_on_hand", "Cash on Hand"),
                ("checking_accounts", "Checking Accounts"),
                ("savings_accounts", "Savings Accounts"),
                ("emergency_savings", "Emergency Savings"),
                ("tsp", "TSP"),
                ("certificates_of_deposit", "Certificates of Deposit (CDs)"),
                ("cash_value_life_insurance", "Cash Value of Life Insurance"),
                ("us_savings_bonds", "U.S. Savings Bonds"),
                ("money_market_accounts", "Money Market Accounts"),
                ("mutual_funds", "Mutual Funds"),
                ("stocks_bonds", "Stocks / Bonds"),
                ("college_funds", "College Funds"),
                ("k401_403b", "401(k) / 403(b)"),
                ("ira_pensions", "IRA / Pensions"),
            ],
        },
        {
            "id": "real_estate",
            "label": "Real Estate",
            "items": [
                ("primary_home", "Primary Home"),
                ("secondary_home", "Secondary Home"),
                ("rental_property", "Rental Property"),
            ],
        },
        {
            "id": "personal_property",
            "label": "Personal Property",
            "items": [
                ("vehicles_motorcycles_boats", "Vehicles / Motorcycles / Boats"),
                ("furniture", "Furniture"),
                ("jewelry", "Jewelry"),
            ],
        },
    ],
    "debts": [
        {
            "id": "housing_creditors",
            "label": "Housing Creditors",
            "items": [
                ("rent_primary_home_mortgage", "Rent / Primary Home Mortgage"),
                ("secondary_home_mortgage", "Secondary Home Mortgage"),
                ("rental_property", "Rental Property"),
                ("other_vacation_home_trailer_timeshare", "Other (Vacation Home / Trailer / Time Share)"),
            ],
        },
        {
            "id": "other_creditors",
            "label": "Other Creditors",
            "items": [
                ("other_creditor", "Creditor"),
            ],
        },
    ],
}


SECTION_UI_DEFAULTS: dict[tuple[str, str], dict[str, str]] = {
    ("income", "service_member_income"): {"displayMode": "visible_when_empty"},
    ("income", "service_member_deductions"): {"displayMode": "show_only_if_used"},
    ("income", "spouse_income"): {"displayMode": "visible_when_empty"},
    ("income", "spouse_deductions"): {"displayMode": "visible_when_empty"},
    ("expenses", "housing"): {"displayMode": "visible_when_empty"},
    ("expenses", "utilities"): {"displayMode": "visible_when_empty"},
    ("expenses", "transportation"): {"displayMode": "visible_when_empty"},
    ("expenses", "food"): {"displayMode": "visible_when_empty"},
    ("expenses", "insurance"): {"displayMode": "visible_when_empty"},
    ("expenses", "healthcare"): {"displayMode": "visible_when_empty"},
    ("expenses", "clothing"): {"displayMode": "visible_when_empty"},
    ("expenses", "child_care"): {"displayMode": "visible_when_empty"},
    ("expenses", "pet_care"): {"displayMode": "visible_when_empty"},
    ("expenses", "personal"): {"displayMode": "visible_when_empty"},
    ("expenses", "education"): {"displayMode": "visible_when_empty"},
    ("expenses", "leisure_hobbies_entertainment"): {"displayMode": "visible_when_empty"},
    ("expenses", "contributions"): {"displayMode": "visible_when_empty"},
    ("expenses", "gifts"): {"displayMode": "visible_when_empty"},
    ("expenses", "miscellaneous"): {"displayMode": "visible_when_empty"},
    ("assets", "savings"): {"displayMode": "visible_when_empty"},
    ("assets", "real_estate"): {"displayMode": "visible_when_empty"},
    ("assets", "personal_property"): {"displayMode": "visible_when_empty"},
    ("debts", "housing_creditors"): {"displayMode": "visible_when_empty"},
    ("debts", "other_creditors"): {"displayMode": "visible_when_empty"},
}


ITEM_UI_DEFAULTS: dict[tuple[str, str, str], dict[str, str]] = {
    ("income", "service_member_income", "other_take_home_pay"): {"entryMode": "manual_only", "displayMode": "visible_when_empty"},
    ("income", "service_member_income", "rental_home_income"): {"entryMode": "manual_only", "displayMode": "visible_when_empty"},
    ("income", "service_member_income", "child_support_alimony_income"): {"entryMode": "manual_only", "displayMode": "visible_when_empty"},
    ("income", "service_member_deductions", "child_support_alimony_paid"): {"entryMode": "manual_only", "displayMode": "show_only_if_used"},
    ("income", "service_member_deductions", "k401"): {"entryMode": "manual_only", "displayMode": "show_only_if_used"},
    ("income", "spouse_income", "monthly_pay"): {"entryMode": "manual_only", "displayMode": "visible_when_empty"},
    ("income", "spouse_income", "spouse_rental_home_income"): {"entryMode": "manual_only", "displayMode": "visible_when_empty"},
    ("income", "spouse_income", "spouse_child_support_alimony_income"): {"entryMode": "manual_only", "displayMode": "visible_when_empty"},
    ("income", "spouse_income", "other_take_home_pay_second_job"): {"entryMode": "manual_only", "displayMode": "visible_when_empty"},
    ("income", "spouse_deductions", "spouse_fitw"): {"entryMode": "manual_only", "displayMode": "show_only_if_used"},
    ("income", "spouse_deductions", "spouse_fica_social_security"): {"entryMode": "manual_only", "displayMode": "show_only_if_used"},
    ("income", "spouse_deductions", "spouse_fica_medicare"): {"entryMode": "manual_only", "displayMode": "show_only_if_used"},
    ("income", "spouse_deductions", "spouse_state_income_tax"): {"entryMode": "manual_only", "displayMode": "show_only_if_used"},
    ("income", "spouse_deductions", "spouse_tsp"): {"entryMode": "manual_only", "displayMode": "show_only_if_used"},
    ("income", "spouse_deductions", "spouse_child_support_alimony_paid"): {"entryMode": "manual_only", "displayMode": "show_only_if_used"},
}


LEGACY_EXPENSE_SECTION_MAP = {
    "housing": "housing",
    "utilities": "utilities",
    "transportation": "transportation",
    "food": "food",
    "insurance": "insurance",
    "healthcare": "healthcare",
    "personal": "personal",
    "entertainment": "leisure_hobbies_entertainment",
    "gifts": "gifts",
    "miscellaneous": "miscellaneous",
}


LEGACY_ASSET_TARGET_MAP = {
    "asset_checking": ("savings", "checking_accounts"),
    "asset_savings": ("savings", "savings_accounts"),
    "asset_tsp": ("savings", "tsp"),
    "asset_roth_ira": ("savings", "ira_pensions"),
    "asset_brokerage": ("savings", "stocks_bonds"),
    "asset_vehicle": ("personal_property", "vehicles_motorcycles_boats"),
}


LEGACY_MANUAL_BASELINE: dict[str, list[dict[str, Any]]] = {
    "income": [],
    "expenses": [
        {"id": "expense_housing", "label": "Housing", "category": "housing", "amountMonthly": 500, "notes": "Current on-base/shared housing cost."},
        {"id": "expense_utilities", "label": "Utilities", "category": "utilities", "amountMonthly": 104, "notes": "Phone and internet."},
        {"id": "expense_transport", "label": "Transportation", "category": "transportation", "amountMonthly": 490, "notes": "Gas, registration, maintenance."},
        {"id": "expense_food", "label": "Food", "category": "food", "amountMonthly": 540, "notes": "Groceries, dining out, lunches."},
        {"id": "expense_insurance", "label": "Insurance", "category": "insurance", "amountMonthly": 182, "notes": "Auto insurance."},
        {"id": "expense_healthcare", "label": "Healthcare OOP", "category": "healthcare", "amountMonthly": 10, "notes": "Prescriptions and small out-of-pocket costs."},
        {"id": "expense_personal", "label": "Personal", "category": "personal", "amountMonthly": 150, "notes": "Barber and personal spending."},
        {"id": "expense_entertainment", "label": "Leisure / Entertainment", "category": "entertainment", "amountMonthly": 98, "notes": "Streaming, AI tools, Audible."},
        {"id": "expense_gifts", "label": "Gifts", "category": "gifts", "amountMonthly": 300, "notes": "Holiday, birthday, anniversary spending."},
        {"id": "expense_misc", "label": "Miscellaneous", "category": "miscellaneous", "amountMonthly": 20, "notes": "Small recurring buffer."},
    ],
    "assets": [
        {"id": "asset_checking", "label": "Checking", "category": "cash", "amount": 2200, "notes": "Combined checking."},
        {"id": "asset_savings", "label": "Savings", "category": "cash", "amount": 8000, "notes": "Savings account."},
        {"id": "asset_tsp", "label": "TSP (Roth)", "category": "retirement", "amount": 25000, "notes": "Demo baseline."},
        {"id": "asset_roth_ira", "label": "Roth IRA", "category": "retirement", "amount": 12000, "notes": "Demo baseline."},
        {"id": "asset_brokerage", "label": "Brokerage", "category": "taxable_investment", "amount": 35000, "notes": "Demo baseline."},
        {"id": "asset_vehicle", "label": "Vehicle", "category": "vehicle", "amount": 28000, "notes": "Estimated vehicle value."},
    ],
    "debts": [],
}


def _default_section_ui(bucket: str, section_id: str) -> dict[str, str]:
    defaults = {"displayMode": "visible_when_empty"}
    defaults.update(SECTION_UI_DEFAULTS.get((bucket, section_id), {}))
    return defaults


def _default_item_ui(bucket: str, section_id: str, item_id: str) -> dict[str, str]:
    defaults = {
        "entryMode": "manual_only",
        "displayMode": "show_only_if_used" if bucket == "debts" else "visible_when_empty",
    }
    if bucket == "income":
        defaults = {
            "entryMode": "reference_backed_hidden",
            "displayMode": "show_only_if_used",
        }
    defaults.update(ITEM_UI_DEFAULTS.get((bucket, section_id, item_id), {}))
    return defaults


def _build_default_item(bucket: str, section_id: str, item_id: str, label: str, sort_order: int) -> dict[str, Any]:
    base = {
        "id": item_id,
        "label": label,
        "notes": "",
        "isCustom": False,
        "sortOrder": sort_order,
        "sourceRefId": None,
        **_default_item_ui(bucket, section_id, item_id),
    }
    if bucket in MONTHLY_BUCKETS:
        base["amountMonthly"] = 0.0
    else:
        base["amount"] = 0.0
    return base


def build_manual_finance_seed() -> dict[str, list[dict[str, Any]]]:
    payload: dict[str, list[dict[str, Any]]] = {}
    for bucket, sections in MANUAL_FINANCE_TEMPLATE.items():
        payload[bucket] = []
        for section_order, section in enumerate(sections):
            payload[bucket].append(
                {
                    "id": section["id"],
                    "label": section["label"],
                    "order": section_order,
                    "isDefault": True,
                    **_default_section_ui(bucket, section["id"]),
                    "items": [
                        _build_default_item(bucket, section["id"], item_id, label, item_order)
                        for item_order, (item_id, label) in enumerate(section["items"])
                    ],
                }
            )
    return payload


def flatten_manual_finance_group(sections: list[dict[str, Any]] | list[dict[str, float]]) -> list[dict[str, Any]]:
    if not sections:
        return []
    if "items" not in sections[0]:
        return sections
    return [
        {**item, "sectionId": section["id"], "sectionLabel": section["label"]}
        for section in sections
        for item in section.get("items", [])
    ]


def _normalize_manual_token(value: Any) -> str:
    return "".join(character for character in str(value or "").lower() if character.isalnum())


def _manual_amount_field(bucket: str) -> str:
    return "amountMonthly" if bucket in MONTHLY_BUCKETS else "amount"


def _copy_manual_item_value(bucket: str, source: dict[str, Any], target: dict[str, Any]) -> None:
    amount_field = _manual_amount_field(bucket)
    target[amount_field] = float(source.get(amount_field, target.get(amount_field, 0)) or 0)
    target["notes"] = source.get("notes", target.get("notes", ""))
    if "sourceRefId" in source:
        target["sourceRefId"] = source.get("sourceRefId")
    if "entryMode" in source:
        target["entryMode"] = source.get("entryMode", target.get("entryMode"))
    if "displayMode" in source:
        target["displayMode"] = source.get("displayMode", target.get("displayMode"))


def normalize_manual_finance_payload(payload: dict[str, list[dict[str, Any]]] | None) -> dict[str, list[dict[str, Any]]]:
    normalized = build_manual_finance_seed()
    if not payload:
        return normalized

    for bucket, sections in payload.items():
        if bucket not in normalized:
            continue
        normalized_sections = normalized[bucket]
        section_by_id = {section["id"]: section for section in normalized_sections}
        section_by_label = {_normalize_manual_token(section["label"]): section for section in normalized_sections}

        for section_index, section in enumerate(sections or []):
            target_section = section_by_id.get(section.get("id")) or section_by_label.get(_normalize_manual_token(section.get("label")))
            if not target_section:
                target_section = {
                    "id": section.get("id") or f"{bucket}_section_{section_index}",
                    "label": section.get("label") or humanize_bucket(bucket),
                    "order": int(section.get("order", len(normalized_sections))),
                    "isDefault": bool(section.get("isDefault", False)),
                    "displayMode": section.get("displayMode", "visible_when_empty"),
                    "items": [],
                }
                normalized_sections.append(target_section)
                section_by_id[target_section["id"]] = target_section
                section_by_label[_normalize_manual_token(target_section["label"])] = target_section
            else:
                target_section["displayMode"] = section.get("displayMode", target_section.get("displayMode", "visible_when_empty"))

            amount_field = _manual_amount_field(bucket)
            default_item_by_id = {item["id"]: item for item in target_section.get("items", []) if not item.get("isCustom")}
            default_item_by_label = {
                _normalize_manual_token(item.get("label")): item
                for item in target_section.get("items", [])
                if not item.get("isCustom")
            }
            existing_item_ids = {item["id"] for item in target_section.get("items", [])}
            next_sort_order = max([-1, *[int(item.get("sortOrder", 0)) for item in target_section.get("items", [])]]) + 1

            for item_index, item in enumerate(section.get("items", [])):
                exact_target = default_item_by_id.get(item.get("id"))
                label_match = None
                if not item.get("isCustom"):
                    label_match = default_item_by_label.get(_normalize_manual_token(item.get("label")))
                target_item = exact_target or label_match
                if target_item:
                    _copy_manual_item_value(bucket, item, target_item)
                    continue

                item_id = item.get("id") or f"{target_section['id']}_item_{item_index}"
                while item_id in existing_item_ids:
                    item_id = f"{item_id}_copy"
                existing_item_ids.add(item_id)
                custom_item = {
                    "id": item_id,
                    "label": item.get("label") or "Custom Item",
                    "notes": item.get("notes", ""),
                    "isCustom": bool(item.get("isCustom", True)),
                    "sortOrder": int(item.get("sortOrder", next_sort_order + item_index)),
                    "sourceRefId": item.get("sourceRefId"),
                    "entryMode": item.get("entryMode", "manual_only"),
                    "displayMode": item.get("displayMode", "visible_when_empty"),
                }
                custom_item[amount_field] = float(item.get(amount_field, 0) or 0)
                target_section.setdefault("items", []).append(custom_item)

    return normalized


def migrate_legacy_manual_inputs(legacy_payload: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    migrated = build_manual_finance_seed()

    for bucket, items in legacy_payload.items():
        if bucket == "expenses":
            for index, item in enumerate(items):
                section_id = LEGACY_EXPENSE_SECTION_MAP.get(item.get("category"), "miscellaneous")
                section = next((entry for entry in migrated["expenses"] if entry["id"] == section_id), None)
                if not section:
                    continue
                section["items"].append(
                    {
                        "id": f"migrated_{item['id']}",
                        "label": item.get("label", "Expense"),
                        "notes": item.get("notes", ""),
                        "amountMonthly": float(item.get("amountMonthly", 0)),
                        "isCustom": True,
                        "sortOrder": len(section["items"]) + index,
                        "sourceRefId": None,
                        "entryMode": "manual_only",
                        "displayMode": "visible_when_empty",
                    }
                )
        elif bucket == "income":
            service_member = migrated["income"][0]
            for index, item in enumerate(items):
                service_member["items"].append(
                    {
                        "id": f"migrated_{item['id']}",
                        "label": item.get("label", "Income"),
                        "notes": item.get("notes", ""),
                        "amountMonthly": float(item.get("amountMonthly", 0)),
                        "isCustom": True,
                        "sortOrder": len(service_member["items"]) + index,
                        "sourceRefId": None,
                        "entryMode": "manual_only",
                        "displayMode": "visible_when_empty",
                    }
                )
        elif bucket == "assets":
            for index, item in enumerate(items):
                mapped = LEGACY_ASSET_TARGET_MAP.get(item["id"])
                if mapped:
                    section_id, item_id = mapped
                    section = next((entry for entry in migrated["assets"] if entry["id"] == section_id), None)
                    if not section:
                        continue
                    target = next((entry for entry in section["items"] if entry["id"] == item_id), None)
                    if target:
                        target["amount"] = float(item.get("amount", 0))
                        target["notes"] = item.get("notes", "")
                        continue
                savings_section = migrated["assets"][0]
                savings_section["items"].append(
                    {
                        "id": f"migrated_{item['id']}",
                        "label": item.get("label", "Asset"),
                        "notes": item.get("notes", ""),
                        "amount": float(item.get("amount", 0)),
                        "isCustom": True,
                        "sortOrder": len(savings_section["items"]) + index,
                        "sourceRefId": None,
                        "entryMode": "manual_only",
                        "displayMode": "visible_when_empty",
                    }
                )
        elif bucket == "debts":
            other_creditors = migrated["debts"][-1]
            for index, item in enumerate(items):
                other_creditors["items"].append(
                    {
                        "id": f"migrated_{item['id']}",
                        "label": item.get("label", "Debt"),
                        "notes": item.get("notes", ""),
                        "amount": float(item.get("amount", 0)),
                        "isCustom": True,
                        "sortOrder": len(other_creditors["items"]) + index,
                        "sourceRefId": None,
                        "entryMode": "manual_only",
                        "displayMode": "visible_when_empty",
                    }
                )

    return normalize_manual_finance_payload(migrated)


def clone_manual_finance_payload(payload: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    return copy.deepcopy(payload)


def humanize_bucket(bucket: str) -> str:
    return bucket.replace("_", " ").title()
