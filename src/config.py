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
            "to the Diputación Permanente, scheduled for 12 Nov 2026. "
            "Validated by the Diputación Permanente on 12 Nov 2026. Summary read from the BOE text "
            "(BOE-A-2026-20823, 7 Oct 2026)."
        ),
        "url": "https://www.boe.es/buscar/doc.php?id=BOE-A-2026-20823",
        "label": "Real Decreto-ley 29/2026",
        "short_label": "RDL 29/2026",
        "law": "Real Decreto-ley 29/2026, de 6 de octubre (BOE 7 Oct 2026) · Spain",
    }
]

# Dated events that frame the snapshot. Context only, not analysed.
CONTEXT_EVENTS = {
    "general_election": "2026-11-29",
    "municipal_election": "2027-05-23",
}

# ---- translations -------------------------------------------------------
# Spanish and Catalan versions of the reader-facing lever texts. Law names
# stay in their official language. Same facts, same dates as the English
# records above; review by a native speaker before relying on the legal lines.
LEVER_I18N = {
    "tourist_licence_phase_out": {
        "es": {
            "title": "Fin progresivo de las licencias de vivienda de uso turístico",
            "timeline_label": "Fin de licencias",
            "jurisdiction": "Cataluña (municipios con problemas de acceso a la vivienda, incluida Barcelona)",
            "rule": (
                "Las viviendas de uso turístico (HUT) existentes en los municipios afectados deben "
                "obtener una licencia urbanística en un plazo de 5 años desde el decreto o dejar de funcionar."
            ),
            "exceptions": [
                "Los propietarios pueden pedir una única prórroga de hasta 5 años más, después del cuarto "
                "año y antes de que acabe el plazo (disposición transitoria 1.2).",
            ],
            "status": (
                "Vigente. Convalidado por el Parlament de Catalunya el 20 dic. 2023; el recurso de "
                "inconstitucionalidad se desestimó por completo (STC 64/2025, 13 mar. 2025)."
            ),
            "notes": (
                "El 9 nov. 2028 termina la transición autonómica. El Ayuntamiento de Barcelona ha dicho "
                "que no prevé conceder las nuevas licencias (prensa de junio de 2024, no reverificada), así "
                "que se espera que la mayoría de licencias caduquen. Es una política anunciada, no un texto legal."
            ),
            "data_limits": (
                "Qué viviendas obtendrán una licencia o una prórroga, y en qué se convertirán las demás "
                "después de 2028: viviendas habituales, alquileres de temporada, ventas o anuncios en otras "
                "plataformas. Un registro estable antes de una fecha límite no dice nada sobre si la política "
                "funcionará, y la baja de un uso turístico no demuestra que el piso pase a alquiler residencial."
            ),
        },
        "ca": {
            "title": "Fi progressiu de les llicències d'habitatge d'ús turístic",
            "timeline_label": "Fi de llicències",
            "jurisdiction": "Catalunya (municipis amb problemes d'accés a l'habitatge, Barcelona inclosa)",
            "rule": (
                "Els habitatges d'ús turístic (HUT) existents als municipis afectats han d'obtenir una "
                "llicència urbanística en un termini de 5 anys des del decret o deixar de funcionar."
            ),
            "exceptions": [
                "Els propietaris poden demanar una única pròrroga de fins a 5 anys més, després del quart "
                "any i abans que acabi el termini (disposició transitòria 1.2).",
            ],
            "status": (
                "Vigent. Convalidat pel Parlament de Catalunya el 20 des. 2023; el recurs "
                "d'inconstitucionalitat es va desestimar íntegrament (STC 64/2025, 13 març 2025)."
            ),
            "notes": (
                "El 9 nov. 2028 acaba la transició autonòmica. L'Ajuntament de Barcelona ha dit que no "
                "preveu concedir les noves llicències (premsa del juny del 2024, no reverificada), de manera "
                "que s'espera que la majoria de llicències caduquin. És una política anunciada, no un text legal."
            ),
            "data_limits": (
                "Quins habitatges obtindran una llicència o una pròrroga, i què esdevindran els altres "
                "després del 2028: habitatges habituals, lloguers de temporada, vendes o anuncis en altres "
                "plataformes. Un registre estable abans d'una data límit no diu res sobre si la política "
                "funcionarà, i la baixa d'un ús turístic no demostra que el pis passi a lloguer residencial."
            ),
        },
    },
    "rent_cap": {
        "es": {
            "title": "Límite del alquiler en zonas tensionadas",
            "timeline_label": "Límite del alquiler",
            "jurisdiction": "España; aplicado en las zonas catalanas declaradas por la Generalitat",
            "rule": (
                "En una zona tensionada declarada, un nuevo contrato de alquiler de vivienda no puede "
                "superar la última renta de los cinco años anteriores (tras su actualización anual). A los "
                "grandes tenedores se les aplica en su lugar el máximo del índice de referencia "
                "(LAU art. 17.6 y 17.7)."
            ),
            "exceptions": [
                "Hasta un 10 % más sobre la renta anterior si la vivienda se ha rehabilitado o mejorado "
                "recientemente, o si el contrato dura 10 años o más.",
                "Una vivienda sin contrato en los últimos cinco años solo queda limitada por el índice "
                "cuando así lo dice la resolución del ministerio para esa zona.",
            ],
            "status": (
                "Vigente. La zona es válida durante 3 años desde el 16 mar. 2024 y se ha prorrogado para "
                "118 municipios mediante la Resolució TER/3739/2026 (DOGC 19 oct. 2026)."
            ),
            "notes": (
                "Barcelona está en la lista técnica de la Generalitat para la prórroga; no se ha "
                "comprobado la fecha de fin de la prórroga."
            ),
            "data_limits": (
                "Si el límite causó algún cambio. La renta media se mueve con el tipo de pisos alquilados, "
                "y los tipos de interés, los salarios y la oferta mueven los alquileres al mismo tiempo. "
                "Tampoco se ve si cada contrato lo cumple."
            ),
        },
        "ca": {
            "title": "Límit del lloguer a les àrees de mercat residencial tens",
            "timeline_label": "Límit del lloguer",
            "jurisdiction": "Espanya; aplicat a les àrees catalanes declarades per la Generalitat",
            "rule": (
                "En una àrea de mercat residencial tens declarada, un nou contracte de lloguer d'habitatge "
                "no pot superar l'última renda dels cinc anys anteriors (després de l'actualització anual). "
                "Als grans tenidors se'ls aplica en canvi el màxim de l'índex de referència "
                "(LAU art. 17.6 i 17.7)."
            ),
            "exceptions": [
                "Fins a un 10 % més sobre la renda anterior si l'habitatge s'ha rehabilitat o millorat "
                "recentment, o si el contracte dura 10 anys o més.",
                "Un habitatge sense contracte els últims cinc anys només queda limitat per l'índex quan "
                "així ho diu la resolució del ministeri per a aquella àrea.",
            ],
            "status": (
                "Vigent. L'àrea és vàlida durant 3 anys des del 16 març 2024 i s'ha prorrogat per a "
                "118 municipis mitjançant la Resolució TER/3739/2026 (DOGC 19 oct. 2026)."
            ),
            "notes": (
                "Barcelona és a la llista tècnica de la Generalitat per a la pròrroga; no s'ha comprovat "
                "la data de fi de la pròrroga."
            ),
            "data_limits": (
                "Si el límit va causar algun canvi. La renda mitjana es mou amb el tipus de pisos llogats, "
                "i els tipus d'interès, els salaris i l'oferta mouen els lloguers alhora. Tampoc no es veu "
                "si cada contracte el compleix."
            ),
        },
    },
    "seasonal_rentals": {
        "es": {
            "title": "Límite del alquiler extendido a los alquileres de temporada",
            "timeline_label": "Límite en alquiler de temporada",
            "jurisdiction": "Cataluña",
            "rule": (
                "En una zona tensionada, un alquiler de temporada que no sea para un uso exclusivamente "
                "vacacional o de ocio se trata como un alquiler de vivienda, así que se le aplican los mismos "
                "límites de renta. Las rentas de los contratos de habitaciones simultáneos no pueden superar "
                "el máximo de la vivienda entera."
            ),
            "exceptions": [
                "Los alquileres para un uso exclusivamente recreativo, turístico o vacacional quedan fuera "
                "de la norma (nuevo art. 66 bis de la Llei 18/2007).",
            ],
            "status": (
                "Vigente. El 9 jun. 2026 se admitió a trámite un recurso de inconstitucionalidad (recurso "
                "2415-2026, contra los arts. 2.2, 3.8, 5.5, 5.6, 5.8, 5.9, 5.14, 5.15 y 8.1). En la fecha de "
                "comprobación no constaba sentencia; las fuentes consultadas no mencionan ninguna suspensión."
            ),
            "notes": "",
            "data_limits": (
                "Si los alquileres de temporada respetan el límite (eso requiere la superficie de cada piso "
                "y el índice oficial), cuánto se quedan realmente los huéspedes, y si el descenso invernal "
                "después de enero se debe a la ley o a un patrón estacional normal."
            ),
        },
        "ca": {
            "title": "Límit del lloguer estès als lloguers de temporada",
            "timeline_label": "Límit al lloguer de temporada",
            "jurisdiction": "Catalunya",
            "rule": (
                "En una àrea tensa, un lloguer de temporada que no sigui per a un ús exclusivament "
                "vacacional o d'oci es tracta com un lloguer d'habitatge, de manera que s'hi apliquen els "
                "mateixos límits de renda. Les rendes dels contractes d'habitacions simultanis no poden "
                "superar el màxim de l'habitatge sencer."
            ),
            "exceptions": [
                "Els lloguers per a un ús exclusivament recreatiu, turístic o vacacional queden fora de la "
                "norma (nou art. 66 bis de la Llei 18/2007).",
            ],
            "status": (
                "Vigent. El 9 juny 2026 es va admetre a tràmit un recurs d'inconstitucionalitat (recurs "
                "2415-2026, contra els arts. 2.2, 3.8, 5.5, 5.6, 5.8, 5.9, 5.14, 5.15 i 8.1). En la data de "
                "comprovació no constava cap sentència; les fonts consultades no esmenten cap suspensió."
            ),
            "notes": "",
            "data_limits": (
                "Si els lloguers de temporada respecten el límit (cal la superfície de cada pis i l'índex "
                "oficial), quant es queden realment els hostes, i si la baixada hivernal després de gener es "
                "deu a la llei o a un patró estacional normal."
            ),
        },
    },
    "owners_vote_catalonia": {
        "es": {
            "title": "Voto de los propietarios sobre el uso turístico: Cataluña",
            "timeline_label": "Voto de propietarios (Cataluña)",
            "jurisdiction": "Cataluña (régimen propio de propiedad horizontal en su Código civil)",
            "rule": (
                "Restringir el uso turístico mediante los estatutos de la comunidad supone modificarlos, lo "
                "que exige el voto de 4/5 de los propietarios que representen también 4/5 de las cuotas de "
                "participación (Código civil de Cataluña, art. 553-26.2.a)."
            ),
            "exceptions": [
                "El artículo se aplica salvo que una disposición legal diga otra cosa; no se han buscado de "
                "forma exhaustiva normas catalanas específicas de turismo.",
            ],
            "status": "Vigente (libro quinto en vigor desde el 1 jul. 2006; artículo comprobado en su versión consolidada).",
            "notes": (
                "Que la regla estatal de tres quintos no se aplica en Cataluña, y que una prohibición solo "
                "alcanza a las nuevas licencias turísticas, lo recogen la prensa catalana (3Cat, VilaWeb, "
                "Betevé) y un análisis jurídico de la Generalitat; el propio texto legal da la mayoría de 4/5."
            ),
            "data_limits": "Nada a escala de edificio. Los archivos no tienen datos sobre comunidades de propietarios ni sus votaciones.",
        },
        "ca": {
            "title": "Vot dels propietaris sobre l'ús turístic: Catalunya",
            "timeline_label": "Vot de propietaris (Catalunya)",
            "jurisdiction": "Catalunya (règim propi de propietat horitzontal al seu Codi civil)",
            "rule": (
                "Restringir l'ús turístic mitjançant els estatuts de la comunitat vol dir modificar-los, cosa "
                "que exigeix el vot de 4/5 dels propietaris que representin també 4/5 de les quotes de "
                "participació (Codi civil de Catalunya, art. 553-26.2.a)."
            ),
            "exceptions": [
                "L'article s'aplica llevat que una disposició legal digui una altra cosa; no s'han cercat de "
                "manera exhaustiva normes catalanes específiques de turisme.",
            ],
            "status": "Vigent (llibre cinquè en vigor des de l'1 jul. 2006; article comprovat en la versió consolidada).",
            "notes": (
                "Que la regla estatal de tres cinquens no s'aplica a Catalunya, i que una prohibició només "
                "afecta les noves llicències turístiques, ho recullen la premsa catalana (3Cat, VilaWeb, "
                "Betevé) i una anàlisi jurídica de la Generalitat; el text legal mateix fixa la majoria de 4/5."
            ),
            "data_limits": "Res a escala d'edifici. Els fitxers no tenen dades sobre comunitats de propietaris ni les seves votacions.",
        },
    },
    "owners_approval_spain": {
        "es": {
            "title": "Aprobación de los propietarios para alquileres turísticos: resto de España",
            "timeline_label": "Aprobación de propietarios (ES)",
            "jurisdiction": "España, Ley de Propiedad Horizontal (se aplica en Madrid, Valencia, Málaga y Sevilla)",
            "rule": (
                "Un nuevo alquiler turístico necesita la aprobación previa y expresa de la comunidad. "
                "Aprobar, limitar, condicionar o prohibir los alquileres turísticos requiere 3/5 de los "
                "propietarios que representen también 3/5 de las cuotas (LPH arts. 5.3 y 17.12, en la "
                "redacción de la LO 1/2025)."
            ),
            "exceptions": [
                "Los alquileres que ya funcionaban antes del 3 abr. 2025 conforme a la normativa turística "
                "pueden continuar (disposición adicional segunda).",
            ],
            "status": "Vigente.",
            "notes": "",
            "data_limits": "Nada a escala de edificio. Los archivos no tienen datos sobre comunidades de propietarios ni sus votaciones.",
        },
        "ca": {
            "title": "Aprovació dels propietaris per als lloguers turístics: resta d'Espanya",
            "timeline_label": "Aprovació de propietaris (ES)",
            "jurisdiction": "Espanya, Ley de Propiedad Horizontal (s'aplica a Madrid, València, Màlaga i Sevilla)",
            "rule": (
                "Un nou lloguer turístic necessita l'aprovació prèvia i expressa de la comunitat. Aprovar, "
                "limitar, condicionar o prohibir els lloguers turístics requereix 3/5 dels propietaris que "
                "representin també 3/5 de les quotes (LPH arts. 5.3 i 17.12, en la redacció de la LO 1/2025)."
            ),
            "exceptions": [
                "Els lloguers que ja funcionaven abans del 3 abr. 2025 d'acord amb la normativa turística "
                "poden continuar (disposició addicional segona).",
            ],
            "status": "Vigent.",
            "notes": "",
            "data_limits": "Res a escala d'edifici. Els fitxers no tenen dades sobre comunitats de propietaris ni les seves votacions.",
        },
    },
}
for _key, _texts in LEVER_I18N.items():
    POLICY_LEVERS[_key]["i18n"] = _texts

LATER_I18N = {
    "2026-10-07": {
        "es": {
            "title": "Real Decreto-ley 29/2026: decreto estatal de vivienda",
            "summary": (
                "Modifica la Ley de Arrendamientos Urbanos (LAU) en los alquileres de temporada y por "
                "habitaciones: un contrato de temporada necesita una causa real y acreditable por la que el "
                "inquilino viva fuera de su vivienda habitual, y debe durar más de 31 días y, como regla "
                "general, no más de 12 meses; en zonas tensionadas se le aplican los límites de renta del "
                "art. 17 de la LAU. También limita las actualizaciones anuales de la renta al 2 % hasta el "
                "31 dic. 2027."
            ),
            "note": (
                "Publicado después de todas las capturas usadas aquí, así que no puede explicar ningún "
                "cambio en los datos. Un real decreto-ley debe convalidarse en el Congreso en 30 días; con "
                "las Cortes disueltas, la votación correspondía a la Diputación Permanente, prevista para el "
                "12 nov. 2026. Convalidado por la Diputación Permanente el 12 nov. 2026. Resumen leído del texto del BOE "
                "(BOE-A-2026-20823, 7 oct. 2026)."
            ),
        },
        "ca": {
            "title": "Real Decreto-ley 29/2026: decret estatal d'habitatge",
            "summary": (
                "Modifica la Ley de Arrendamientos Urbanos (LAU) en els lloguers de temporada i per "
                "habitacions: un contracte de temporada necessita una causa real i acreditable per la qual "
                "l'inquilí visqui fora del seu habitatge habitual, i ha de durar més de 31 dies i, com a regla "
                "general, no més de 12 mesos; a les àrees tenses s'hi apliquen els límits de renda de l'art. 17 "
                "de la LAU. També limita les actualitzacions anuals de la renda al 2 % fins al 31 des. 2027."
            ),
            "note": (
                "Publicat després de totes les captures que s'usen aquí, de manera que no pot explicar cap "
                "canvi en les dades. Un reial decret llei s'ha de convalidar al Congrés en 30 dies; amb les "
                "Corts dissoltes, la votació corresponia a la Diputació Permanent, prevista per al "
                "12 nov. 2026. Convalidat per la Diputació Permanent el 12 nov. 2026. Resum llegit del text del BOE "
                "(BOE-A-2026-20823, 7 oct. 2026)."
            ),
        },
    },
}
for _later in POST_OBSERVATION_DEVELOPMENTS:
    if _later["date"] in LATER_I18N:
        _later["i18n"] = LATER_I18N[_later["date"]]

# ---- publication ---------------------------------------------------------
AUTHOR = "Renzo Rico"
PUBLISHED_ON = "2026-11-12"

SEED = 42
