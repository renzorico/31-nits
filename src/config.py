"""All the project's settings and thresholds in one place.

If a number can be argued with ("why 31 and not 30?"), it lives here,
so there is exactly one copy to find and change.
"""

from pathlib import Path

from . import sources

# The Barcelona snapshot notebooks 01-02 analyse in depth. Inside Airbnb
# publishes a new one every quarter, so without this date the numbers
# cannot be reproduced. All snapshots are listed in src/sources.py.
SNAPSHOT_DATE = "2026-09-17"

# ---- paths -----------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]
LISTINGS_FILE = sources.listings_path("barcelona", SNAPSHOT_DATE)
CLEAN_FILE = PROJECT_ROOT / "data" / "listings_clean.csv"
FIGURES_DIR = PROJECT_ROOT / "reports" / "figures"
FIGURES_DIR.mkdir(parents=True, exist_ok=True)

# ---- cleaning thresholds ---------------------------------------------
# Same cap as the Berlin project, kept for comparability. In Barcelona it
# removes 295 listings (2.7% of priced ones), almost all tourist entire
# homes; the 99th percentile is ~2,000 EUR.
MAX_PRICE = 1000

# The Catalan tourist-stay limit: a tourist flat (HUT) is let for an "estada
# de temporada", "a continuous period of 31 days or fewer" (Decret 75/2020,
# art. 221-1, as quoted in STC 64/2025, BOE-A-2025-7430). An HUT must be let
# whole (Llei 13/2002, art. 50 bis), so private rooms cannot hold one.
# Whether a 31-NIGHT booking counts as "31 days or fewer" is ambiguous, so
# listings are only ever labelled by what they ask: under 31, exactly 31 or
# over 31 nights minimum. A minimum stay is a setting, not a contract, an
# actual stay or a legal finding. Outside Catalonia this number has no legal
# meaning, and 31+ is used there only as a common measurement threshold.
STAY_LINE_NIGHTS = 31

# A host with this many listings or more is treated as professional.
PROFESSIONAL_MIN = 5

# ---- geography --------------------------------------------------------
# Barcelona's 10 districts, copied EXACTLY as they appear in the file.
# Check against df["neighbourhood_group"].unique() after download.
CENTRAL_DISTRICTS = [
    "Ciutat Vella",
    "Eixample",
    "Gràcia",
]

# ---- policy levers ----------------------------------------------------
# Selected rules, not every rule in force. Neutral by design: what the rule
# says, who it applies to and when, never who proposed it. Each record names
# its jurisdiction and mechanism, because the same-sounding rule differs
# between Catalonia and the rest of Spain. Texts were checked against the
# official gazettes on LEVERS_AS_OF; "sources" are primary texts.
LEVERS_AS_OF = "2026-10-22"
OBSERVATION_WINDOW = ("2025-12-14", "2026-09-28")  # first and last snapshot dates

POLICY_LEVERS = {
    "tourist_licence_phase_out": {
        "title": "Tourist-flat licence phase-out",
        "timeline_label": "Licence phase-out",
        "jurisdiction": "Catalonia (municipalities with housing-access problems, Barcelona included)",
        "applies_to": ["barcelona"],
        "mechanism": "Licensing transition",
        "rule": (
            "Existing tourist flats (HUT) in the affected municipalities must "
            "obtain an urban-planning licence within 5 years of the decree, or "
            "stop operating."
        ),
        "exceptions": [
            "Owners can request one extension of up to 5 more years, after "
            "year 4 and before the period ends (transitional provision 1.2).",
        ],
        "law": "Decret llei 3/2023, de 7 de novembre (DOGC 9036, 8 Nov 2023)",
        "applies_from": "2023-11-09",
        "deadline": "2028-11-09",
        "status": (
            "In force. Ratified by the Catalan Parliament on 20 Dec 2023; the "
            "constitutional challenge was dismissed in full (STC 64/2025, "
            "13 Mar 2025)."
        ),
        "status_checked_on": LEVERS_AS_OF,
        "sources": [
            {
                "label": "STC 64/2025 (BOE)",
                "url": "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-7430",
            }
        ],
        "notes": (
            "The 9 Nov 2028 date ends the regional transition. Barcelona's "
            "council has said it does not plan to grant the new licences "
            "(press reports from June 2024, not re-checked), so most licences "
            "are expected to lapse. That is a stated policy, not a legal text."
        ),
        "data_limits": (
            "Which flats will obtain a licence or an extension, and what the "
            "others become after 2028: long-term homes, seasonal lets, sales "
            "or listings on other platforms. A stable register before a "
            "deadline says nothing about whether the policy will work, and a "
            "cancelled tourist use does not show conversion to a residential "
            "lease."
        ),
    },
    "rent_cap": {
        "title": "Rent limit in stressed zones",
        "timeline_label": "Rent limit",
        "jurisdiction": "Spain; applied in the Catalan zones declared by the Generalitat",
        "applies_to": ["barcelona"],
        "mechanism": "Rent limit on new leases",
        "rule": (
            "In a declared stressed zone, a new housing lease cannot exceed "
            "the last rent of the previous five years (after its annual "
            "update). Large landlords are limited by the reference-index "
            "maximum instead (LAU art. 17.6 and 17.7)."
        ),
        "exceptions": [
            "Up to +10% over the previous rent when the flat was recently "
            "renovated or improved, or the lease runs 10 years or more.",
            "A flat with no lease in the last five years is limited by the "
            "index only where the ministry's resolution for that zone says so.",
        ],
        "law": "Ley 12/2023, de 24 de mayo; LAU art. 17.6-7; Resolució TER/800/2024 (Catalan zones)",
        "applies_from": "2024-03-16",
        "deadline": None,
        "status": (
            "In force. The zone is valid for 3 years from 16 Mar 2024 and has "
            "been extended for 118 municipalities by Resolució TER/3739/2026 "
            "(DOGC 19 Oct 2026)."
        ),
        "status_checked_on": LEVERS_AS_OF,
        "sources": [
            {
                "label": "LAU art. 17 (BOE, consolidated)",
                "url": "https://www.boe.es/buscar/act.php?id=BOE-A-1994-26003#a17",
            },
            {
                "label": "Zone declaration summary (BOE-A-2024-5214)",
                "url": "https://www.boe.es/boe/dias/2024/03/15/pdfs/BOE-A-2024-5214.pdf",
            },
        ],
        "notes": (
            "Barcelona is on the Generalitat's technical list for the "
            "extension; the extension's end date was not checked."
        ),
        "data_limits": (
            "Whether the limit caused any change. The average rent moves with "
            "the mix of flats rented, and interest rates, wages and supply "
            "move rents at the same time. Compliance of individual contracts "
            "is not visible either."
        ),
    },
    "seasonal_rentals": {
        "title": "Rent limit extended to seasonal lets",
        "timeline_label": "Seasonal-let limit",
        "jurisdiction": "Catalonia",
        "applies_to": ["barcelona"],
        "mechanism": "Lease classification",
        "rule": (
            "In a stressed zone, a seasonal let that is not for exclusively "
            "holiday or leisure use is treated as a housing lease, so the "
            "same rent limits apply. The rents of simultaneous room contracts "
            "cannot exceed the maximum for the whole flat."
        ),
        "exceptions": [
            "Lets for exclusively recreational, tourist or holiday use are "
            "outside the rule (new art. 66 bis of Llei 18/2007).",
        ],
        "law": "Llei 11/2025, de 29 de desembre (DOGC 9574, 31 Dec 2025)",
        "applies_from": "2026-01-01",
        "deadline": None,
        "status": (
            "In force. A constitutional challenge was admitted for processing "
            "on 9 Jun 2026 (recurso 2415-2026, against arts. 2.2, 3.8, 5.5, "
            "5.6, 5.8, 5.9, 5.14, 5.15 and 8.1). No ruling was found as of "
            "the check date; the sources checked do not mention a suspension."
        ),
        "status_checked_on": LEVERS_AS_OF,
        "sources": [
            {
                "label": "Llei 11/2025 (BOE)",
                "url": "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-5547",
            },
            {
                "label": "Challenge admitted (BOE-A-2026-13028)",
                "url": "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-13028",
            },
        ],
        "notes": "",
        "data_limits": (
            "Whether seasonal lets respect the limit (that needs each flat's "
            "size and the official index), how long guests actually stay, and "
            "whether the winter dip after January is the law or an ordinary "
            "seasonal pattern."
        ),
    },
    "owners_vote_catalonia": {
        "title": "Owners' vote on tourist use: Catalonia",
        "timeline_label": "Owners' vote (Catalonia)",
        "jurisdiction": "Catalonia (its own Civil Code regime for horizontal property)",
        "applies_to": ["barcelona"],
        "mechanism": "Owners' vote on community statutes",
        "rule": (
            "Restricting tourist use through a community's statutes means "
            "changing the statutes, which needs the votes of 4/5 of the "
            "owners who also hold 4/5 of the participation shares "
            "(Catalan Civil Code art. 553-26.2.a)."
        ),
        "exceptions": [
            "The article applies unless a legal provision says otherwise; "
            "any Catalan tourism-specific provision was not exhaustively "
            "searched.",
        ],
        "law": "Llei 5/2006, llibre cinquè del Codi civil de Catalunya, art. 553-26",
        "applies_from": "2006-07-01",
        "deadline": None,
        "status": "In force (book five in force since 1 Jul 2006; article checked as consolidated).",
        "status_checked_on": LEVERS_AS_OF,
        "sources": [
            {
                "label": "Catalan Civil Code, book five (BOE, consolidated)",
                "url": "https://www.boe.es/buscar/act.php?id=BOE-A-2006-11130#a55326",
            }
        ],
        "notes": (
            "That the national three-fifths rule does not apply in Catalonia, "
            "and that a ban only reaches new tourist licences, is reported by "
            "Catalan press (3Cat, VilaWeb, Betevé) and a Generalitat legal "
            "analysis; the statute text itself gives the 4/5 majority."
        ),
        "data_limits": (
            "Anything at building level. The files have no data on owners' "
            "associations or their votes."
        ),
    },
    "owners_approval_spain": {
        "title": "Owners' approval of tourist lets: rest of Spain",
        "timeline_label": "Owners' approval (ES)",
        "jurisdiction": "Spain, Ley de Propiedad Horizontal (applies to Madrid, Valencia, Málaga and Sevilla)",
        "applies_to": ["madrid", "valencia", "malaga", "sevilla"],
        "mechanism": "Prior community approval",
        "rule": (
            "A new tourist let needs the community's prior express approval. "
            "Approving, limiting, conditioning or prohibiting tourist lets "
            "takes 3/5 of the owners who also hold 3/5 of the shares "
            "(LPH arts. 5.3 and 17.12, as amended by LO 1/2025)."
        ),
        "exceptions": [
            "Lets already operating before 3 Apr 2025 under the tourist "
            "rules can continue (additional provision 2).",
        ],
        "law": "Ley Orgánica 1/2025, de 2 de enero (BOE 3 Jan 2025), amending the LPH",
        "applies_from": "2025-04-03",
        "deadline": None,
        "status": "In force.",
        "status_checked_on": LEVERS_AS_OF,
        "sources": [
            {
                "label": "Ley de Propiedad Horizontal (BOE, consolidated)",
                "url": "https://www.boe.es/buscar/act.php?id=BOE-A-1960-10906",
            }
        ],
        "notes": "",
        "data_limits": (
            "Anything at building level. The files have no data on owners' "
            "associations or their votes."
        ),
    },
}

# Developments after the last snapshot: context for the reader, never an
# explanation of anything in the data.
POST_OBSERVATION_DEVELOPMENTS = [
    {
        "date": "2026-10-07",
        "title": "Real Decreto-ley 29/2026: national housing decree",
        "summary": (
            "Amends the national tenancy law (LAU) on temporary and room "
            "rentals: a temporary lease needs a real, provable reason for the "
            "tenant to live away from their habitual home and must run more "
            "than 31 days and, as a rule, no more than 12 months; in stressed "
            "zones the rent limits of LAU art. 17 apply to it. It also caps "
            "annual rent updates at 2% until 31 Dec 2027."
        ),
        "note": (
            "Published after every snapshot used here, so it cannot explain "
            "any change in the data. A decree-law must be validated by "
            "Congress within 30 days; with the Cortes dissolved, the vote fell "
            "to the Diputación Permanente, scheduled for 12 Nov 2026. Its "
            "result was not checked here. Summary read from the BOE text "
            "(BOE-A-2026-20823, 7 Oct 2026)."
        ),
        "url": "https://www.boe.es/buscar/doc.php?id=BOE-A-2026-20823",
    }
]

# Dated events that frame the snapshot. Context only, not analysed.
CONTEXT_EVENTS = {
    "general_election": "2026-11-29",
    "municipal_election": "2027-05-23",
}

SEED = 42
