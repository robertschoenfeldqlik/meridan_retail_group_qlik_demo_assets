#!/usr/bin/env python3
"""
deploy_qlik.py — Qlik Cloud Deployment for Meridian Commerce Group Full Stack Demo

Interactive deployment script that provisions spaces, creates data connections
(PostgreSQL, Salesforce, Kafka, S3), uploads the MCG dark theme, imports apps,
sets up Qlik Answers knowledge bases, configures assistants, creates automations
(including Talend address correction trigger), deploys Gold-layer data product
definitions, and populates a business glossary.

Usage:
    python deploy_qlik.py                    # Interactive setup wizard
    python deploy_qlik.py --config config.json  # Use saved config
    python deploy_qlik.py --dry-run          # Preview without changes
    python deploy_qlik.py --skip-prompts     # Use config.json, no prompts

Data files:
    deploy/data_products.json              — 7 Gold-layer data product definitions
    deploy/glossary_terms.json             — 25 business glossary terms
    deploy/automations/*.json              — Automation templates (Teams alerts, etc.)
    deploy/themes/mcg-dark-theme.zip       — MCG Dark Theme extension package

Post-deploy manual steps (see creation_guide.md):
    - Open Lakehouse: Bronze/Silver/Gold layer configuration
    - Data Flows: 8 transformation routes + Talend address validation job
    - Table Recipes: 7 Gold-layer aggregations
    - Qlik Predict: 2 AutoML experiments (Spoilage Risk, SLA Prediction)
    - Semantic Types, AI-Suggested Validation Rules, AI-Driven Descriptions

Requirements:
    pip install requests
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import getpass
from pathlib import Path
from datetime import datetime

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package is required. Install with: pip install requests")
    sys.exit(1)

# ---------------------------------------------------------------------------
#  Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DOCUMENTS_DIR = PROJECT_DIR / "documents"
APPS_DIR = SCRIPT_DIR / "apps"
AUTOMATIONS_DIR = SCRIPT_DIR / "automations"
THEMES_DIR = SCRIPT_DIR / "themes"
INFRASTRUCTURE_DIR = PROJECT_DIR / "infrastructure" / "kafka"
SIMULATORS_DIR = PROJECT_DIR / "simulators"
DATA_PRODUCTS_FILE = SCRIPT_DIR / "data_products.json"
GLOSSARY_FILE = SCRIPT_DIR / "glossary_terms.json"
CONFIG_PATH = SCRIPT_DIR / "config.json"

QLIK_REGIONS = [
    ("us.qlikcloud.com", "US (North America)"),
    ("eu.qlikcloud.com", "EU (Europe)"),
    ("ap.qlikcloud.com", "AP (Asia Pacific)"),
    ("us-gov.qlikcloud.us", "US Gov (FedRAMP)"),
]

# Deployment components the user can toggle
COMPONENTS = [
    ("infrastructure", "Start Kafka Infrastructure (Docker Compose — Confluent)"),
    ("spaces",        "Create Spaces (shared + managed)"),
    ("connections",   "Create Data Connections (PostgreSQL, Salesforce, Kafka, S3)"),
    ("theme",         "Upload MCG Dark Theme Extension"),
    ("apps",          "Import & Publish Analytics Apps (.qvf)"),
    ("knowledge",     "Create Qlik Answers Knowledge Base + Upload Documents"),
    ("assistant",     "Create Qlik Answers Assistant"),
    ("automations",   "Create Automations (scheduled reloads, alerts, Talend address correction)"),
    ("dataproducts",  "Create Data Products (Gold layer definitions)"),
    ("glossary",      "Create Business Glossary Terms"),
]


# ---------------------------------------------------------------------------
#  Logger
# ---------------------------------------------------------------------------

class Logger:
    def __init__(self, verbose=False):
        self.verbose = verbose
        self._start = time.time()

    def _ts(self):
        elapsed = time.time() - self._start
        return f"[+{elapsed:.1f}s]"

    def info(self, msg):    print(f"{self._ts()}  INFO   {msg}")
    def ok(self, msg):      print(f"{self._ts()}  OK     {msg}")
    def warn(self, msg):    print(f"{self._ts()}  WARN   {msg}")
    def error(self, msg):   print(f"{self._ts()}  ERROR  {msg}", file=sys.stderr)
    def debug(self, msg):
        if self.verbose:
            print(f"{self._ts()}  DEBUG  {msg}")

    def section(self, title):
        bar = "=" * 60
        print(f"\n{bar}\n  {title}\n{bar}")

    def step(self, num, total, title):
        print(f"\n--- Step {num}/{total}: {title} ---")


# ---------------------------------------------------------------------------
#  Interactive Setup Wizard
# ---------------------------------------------------------------------------

def prompt(label, default=None, secret=False, required=True):
    """Prompt user for input with optional default and secret mode."""
    suffix = f" [{default}]" if default else ""
    prompt_str = f"  {label}{suffix}: "

    while True:
        if secret:
            value = getpass.getpass(prompt_str)
        else:
            value = input(prompt_str)

        value = value.strip()
        if not value and default:
            return default
        if value:
            return value
        if not required:
            return ""
        print("    (required — please enter a value)")


def prompt_choice(label, choices, default=1):
    """Prompt user to pick from a numbered list."""
    print(f"\n  {label}")
    for i, (value, desc) in enumerate(choices, 1):
        marker = " *" if i == default else ""
        print(f"    {i}. {desc}{marker}")

    while True:
        raw = input(f"  Choice [{default}]: ").strip()
        if not raw:
            return choices[default - 1][0]
        try:
            idx = int(raw)
            if 1 <= idx <= len(choices):
                return choices[idx - 1][0]
        except ValueError:
            pass
        print(f"    (enter a number 1-{len(choices)})")


def prompt_yes_no(label, default=True):
    """Yes/no prompt."""
    hint = "Y/n" if default else "y/N"
    raw = input(f"  {label} [{hint}]: ").strip().lower()
    if not raw:
        return default
    return raw in ("y", "yes")


def prompt_multi_select(label, options, defaults=None):
    """Let user toggle multiple options on/off."""
    if defaults is None:
        defaults = [True] * len(options)

    selected = list(defaults)
    print(f"\n  {label}")
    for i, (key, desc) in enumerate(options):
        marker = "[x]" if selected[i] else "[ ]"
        print(f"    {i + 1}. {marker} {desc}")

    raw = input("  Enter numbers to toggle (e.g. 1,3,5) or press Enter for defaults: ").strip()
    if raw:
        for token in raw.replace(" ", ",").split(","):
            try:
                idx = int(token) - 1
                if 0 <= idx < len(options):
                    selected[idx] = not selected[idx]
            except ValueError:
                pass

    return {options[i][0]: selected[i] for i in range(len(options))}


def run_setup_wizard(existing_config=None):
    """Interactive setup wizard that returns a config dict."""
    cfg = existing_config or {}

    print("\n" + "=" * 60)
    print("  Qlik Cloud Deployment — Setup Wizard")
    print("  Meridian Commerce Group Demo")
    print("=" * 60)

    # --- Tenant ---
    print("\n-- Tenant Configuration --")
    tenant = cfg.get("tenant", {})
    tenant["hostname"] = prompt(
        "Tenant hostname (e.g. 'mcg-demo')",
        default=tenant.get("hostname"),
    )
    tenant["region"] = prompt_choice(
        "Qlik Cloud region:",
        QLIK_REGIONS,
        default=next(
            (i for i, (v, _) in enumerate(QLIK_REGIONS, 1) if v == tenant.get("region")),
            1
        ),
    )
    cfg["tenant"] = tenant
    base_url = f"https://{tenant['hostname']}.{tenant['region']}"
    print(f"\n  -> Base URL: {base_url}")

    # --- Authentication ---
    print("\n-- Authentication --")
    auth = cfg.get("auth", {})
    auth_method = prompt_choice(
        "Authentication method:",
        [("apikey", "API Key (simple, good for dev/demos)"),
         ("oauth",  "OAuth M2M (recommended for production/CI)")],
        default=1 if auth.get("method", "apikey") == "apikey" else 2,
    )
    auth["method"] = auth_method

    if auth_method == "apikey":
        existing_key = auth.get("apiKey", "")
        masked = f"...{existing_key[-6:]}" if len(existing_key) > 6 else ""
        if masked:
            print(f"  Current API key: {masked}")
            if prompt_yes_no("Update API key?", default=False):
                auth["apiKey"] = prompt("API Key", secret=True)
        else:
            auth["apiKey"] = prompt("API Key", secret=True)
    else:
        oauth = auth.get("oauth", {})
        oauth["clientId"] = prompt("OAuth Client ID", default=oauth.get("clientId"))
        oauth["clientSecret"] = prompt("OAuth Client Secret", secret=True,
                                        default=oauth.get("clientSecret"))
        oauth["tokenUrl"] = prompt("OAuth Token URL",
                                    default=oauth.get("tokenUrl", f"{base_url}/oauth/token"))
        auth["oauth"] = oauth

    cfg["auth"] = auth

    # --- Spaces ---
    print("\n-- Spaces --")
    spaces = cfg.get("spaces", {})
    spaces["shared"] = prompt("Shared space name", default=spaces.get("shared", "MCG Demo - Development"))
    spaces["managed"] = prompt("Managed space name", default=spaces.get("managed", "MCG Demo - Published"))
    cfg["spaces"] = spaces

    # --- Kafka Infrastructure ---
    print("\n-- Kafka Infrastructure --")
    print("  MCG requires two Kafka topics for IoT streaming data:")
    print("    • mcg.iot.cold-chain     (sensor readings)")
    print("    • mcg.iot.carrier-events (carrier status updates)")

    infra = cfg.get("infrastructure", {})
    if prompt_yes_no("Set up Kafka infrastructure?", default=True):
        has_docker = check_docker()
        if has_docker:
            use_docker = prompt_yes_no(
                "Use Docker Compose (Confluent stack — recommended for demos)?",
                default=infra.get("useDocker", True),
            )
            infra["useDocker"] = use_docker
            if use_docker:
                print("  -> Will start Confluent Kafka via Docker Compose.")
                print(f"     Compose file: {DOCKER_COMPOSE_FILE}")
            else:
                print("  -> Will create topics on your existing Kafka cluster.")
                bs = cfg.get("dataConnections", {}).get("kafka", {}).get("bootstrapServers", "")
                if not bs:
                    bs = prompt("Kafka bootstrap servers (host:port)", default="localhost:9092")
                    cfg.setdefault("dataConnections", {}).setdefault("kafka", {})["bootstrapServers"] = bs
        else:
            print("  Docker not found — will create topics on an external Kafka cluster.")
            infra["useDocker"] = False
            bs = cfg.get("dataConnections", {}).get("kafka", {}).get("bootstrapServers", "")
            if not bs:
                bs = prompt("Kafka bootstrap servers (host:port)")
                cfg.setdefault("dataConnections", {}).setdefault("kafka", {})["bootstrapServers"] = bs
    else:
        print("  -> Skipping Kafka setup. You can configure it later.")
        infra["skipInfrastructure"] = True

    cfg["infrastructure"] = infra

    # --- Components to deploy ---
    print("\n-- Select Components to Deploy --")
    enabled = cfg.get("enabledComponents", {})
    # Default infrastructure to False if user chose to skip
    if infra.get("skipInfrastructure"):
        enabled["infrastructure"] = False
    defaults = [enabled.get(key, True) for key, _ in COMPONENTS]
    enabled = prompt_multi_select("Toggle deployment components:", COMPONENTS, defaults)
    cfg["enabledComponents"] = enabled

    # --- Data Connections (if enabled) ---
    if enabled.get("connections"):
        print("\n-- Data Connections --")
        print("  Configure connection credentials (press Enter to skip any).")
        conns = cfg.get("dataConnections", {})

        # PostgreSQL
        if prompt_yes_no("Configure PostgreSQL (WMS) connection?",
                          default=bool(conns.get("postgresql"))):
            pg = conns.get("postgresql", {})
            pg["name"] = prompt("Connection name", default=pg.get("name", "MCG WMS Database"))
            pg["host"] = prompt("Host", default=pg.get("host"))
            pg["port"] = int(prompt("Port", default=str(pg.get("port", 5432))))
            pg["database"] = prompt("Database", default=pg.get("database", "mcg_wms"))
            pg["username"] = prompt("Username", default=pg.get("username", "qlik_reader"))
            pg["password"] = prompt("Password", secret=True, default=pg.get("password"))
            pg["schema"] = prompt("Schema", default=pg.get("schema", "public"), required=False)
            conns["postgresql"] = pg

        # Salesforce
        if prompt_yes_no("Configure Salesforce (CRM) connection?",
                          default=bool(conns.get("salesforce"))):
            sf = conns.get("salesforce", {})
            sf["name"] = prompt("Connection name", default=sf.get("name", "MCG Salesforce CRM"))
            sf["username"] = prompt("SF Username", default=sf.get("username"))
            sf["password"] = prompt("SF Password", secret=True, default=sf.get("password"))
            sf["securityToken"] = prompt("SF Security Token", secret=True,
                                          default=sf.get("securityToken"))
            sf["isSandbox"] = prompt_yes_no("Is this a Sandbox?",
                                             default=sf.get("isSandbox", True))
            conns["salesforce"] = sf

        # Kafka
        if prompt_yes_no("Configure Kafka (IoT Telemetry) connection?",
                          default=bool(conns.get("kafka"))):
            kf = conns.get("kafka", {})
            kf["name"] = prompt("Connection name", default=kf.get("name", "MCG IoT Telemetry"))
            kf["bootstrapServers"] = prompt("Bootstrap servers",
                                             default=kf.get("bootstrapServers"))
            if not kf.get("topics"):
                kf["topics"] = ["mcg.iot.cold-chain", "mcg.iot.carrier-events"]
                print(f"    Using default topics: {', '.join(kf['topics'])}")
            kf["securityProtocol"] = prompt("Security protocol",
                                             default=kf.get("securityProtocol", "SASL_SSL"))
            kf["saslMechanism"] = prompt("SASL mechanism",
                                          default=kf.get("saslMechanism", "PLAIN"))
            kf["saslUsername"] = prompt("SASL username", default=kf.get("saslUsername"))
            kf["saslPassword"] = prompt("SASL password", secret=True,
                                         default=kf.get("saslPassword"))
            conns["kafka"] = kf

        # S3
        if prompt_yes_no("Configure S3 (file storage) connection?",
                          default=bool(conns.get("s3"))):
            s3 = conns.get("s3", {})
            s3["name"] = prompt("Connection name", default=s3.get("name", "MCG Flat File Outputs"))
            s3["bucketName"] = prompt("Bucket name", default=s3.get("bucketName"))
            s3["region"] = prompt("AWS Region", default=s3.get("region", "eu-west-1"))
            s3["accessKeyId"] = prompt("Access Key ID", default=s3.get("accessKeyId"))
            s3["secretAccessKey"] = prompt("Secret Access Key", secret=True,
                                            default=s3.get("secretAccessKey"))
            s3["prefix"] = prompt("Object prefix", default=s3.get("prefix", "exports/"),
                                   required=False)
            conns["s3"] = s3

        cfg["dataConnections"] = conns

    # --- Knowledge Base ---
    if enabled.get("knowledge"):
        print("\n-- Qlik Answers Knowledge Base --")
        kb = cfg.get("knowledgeBase", {})
        kb["name"] = prompt("Knowledge base name",
                             default=kb.get("name", "MCG Operations Knowledge Base"))
        kb["description"] = prompt("Description",
                                    default=kb.get("description",
                                    "Operational documents for Meridian Commerce Group."),
                                    required=False)
        cfg["knowledgeBase"] = kb

    # --- Assistant ---
    if enabled.get("assistant"):
        print("\n-- Qlik Answers Assistant --")
        ast = cfg.get("assistant", {})
        ast["name"] = prompt("Assistant name",
                              default=ast.get("name", "MCG Operations Assistant"))
        ast["description"] = prompt("Description",
                                     default=ast.get("description",
                                     "AI assistant for MCG operations — procedures, incidents, policies, and Project CLARITY."),
                                     required=False)
        if not ast.get("conversationStarters"):
            ast["conversationStarters"] = [
                "What is the procedure for goods receiving?",
                "What happened during the Rotterdam pipeline failure?",
                "What are the cold chain temperature requirements?",
                "What is Project CLARITY and what problem does it solve?",
                "What was the lettuce recall and what went wrong?",
            ]
        cfg["assistant"] = ast

    # --- Options ---
    print("\n-- Deployment Options --")
    opts = cfg.get("options", {})
    opts["verbose"] = prompt_yes_no("Verbose logging?", default=opts.get("verbose", True))
    opts["continueOnError"] = prompt_yes_no("Continue on error (skip failed steps)?",
                                             default=opts.get("continueOnError", True))
    cfg["options"] = opts

    # --- Save config ---
    if prompt_yes_no(f"\nSave configuration to {CONFIG_PATH}?", default=True):
        save_config(cfg)
        print(f"  -> Saved to {CONFIG_PATH}")

    return cfg


def save_config(cfg):
    """Save config dict to JSON, masking secrets in the saved file."""
    safe = json.loads(json.dumps(cfg))  # deep copy

    # We save everything including secrets — the file should be gitignored
    CONFIG_PATH.write_text(json.dumps(safe, indent=2), encoding="utf-8")


def load_config():
    """Load config from file."""
    if not CONFIG_PATH.exists():
        return None
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
#  Qlik Cloud API Client
# ---------------------------------------------------------------------------

class QlikClient:
    def __init__(self, cfg, log, dry_run=False):
        self.cfg = cfg
        self.log = log
        self.dry_run = dry_run
        t = cfg["tenant"]
        self.base_url = f"https://{t['hostname']}.{t['region']}"
        self._token = None
        self._session = requests.Session()
        self._session.headers.update({"Accept": "application/json"})

    # --- Auth -----------------------------------------------------------------

    def authenticate(self):
        method = self.cfg["auth"]["method"]

        if method == "apikey":
            self._token = self.cfg["auth"]["apiKey"]
            if not self._token:
                raise RuntimeError("API key is empty. Set it in config or via QLIK_API_KEY env var.")
            self._session.headers["Authorization"] = f"Bearer {self._token}"
            self.log.ok(f"Authenticated via API key (...{self._token[-6:]})")
            return

        if method == "oauth":
            oauth = self.cfg["auth"]["oauth"]
            token_url = oauth.get("tokenUrl", f"{self.base_url}/oauth/token")
            self.log.info(f"Requesting OAuth M2M token from {token_url}")

            if self.dry_run:
                self._token = "DRY_RUN_TOKEN"
                self._session.headers["Authorization"] = "Bearer DRY_RUN_TOKEN"
                self.log.ok("DRY RUN: Skipped OAuth token request.")
                return

            resp = requests.post(token_url, data={
                "grant_type": "client_credentials",
                "client_id": oauth["clientId"],
                "client_secret": oauth["clientSecret"],
            })
            if resp.status_code != 200:
                raise RuntimeError(f"OAuth token failed ({resp.status_code}): {resp.text}")

            self._token = resp.json()["access_token"]
            self._session.headers["Authorization"] = f"Bearer {self._token}"
            self.log.ok("Authenticated via OAuth M2M.")
            return

        raise RuntimeError(f'Unknown auth method: "{method}". Use "apikey" or "oauth".')

    # --- Verify connection ---

    def verify_connection(self):
        """Quick check that we can reach the tenant."""
        if self.dry_run:
            self.log.ok("DRY RUN: Skipped connection verification.")
            return True

        resp = self._get("/api/v1/users/me")
        if resp.status_code == 200:
            user = resp.json()
            name = user.get("name", user.get("subject", "unknown"))
            self.log.ok(f"Connected as: {name}")
            return True
        else:
            self.log.error(f"Connection check failed ({resp.status_code}): {resp.text[:200]}")
            return False

    # --- HTTP helpers ---------------------------------------------------------

    def _url(self, path):
        return f"{self.base_url}{path}"

    def _get(self, path, params=None):
        url = self._url(path)
        self.log.debug(f"GET {url}")
        return self._session.get(url, params=params, timeout=60)

    def _post(self, path, json_body=None, **kwargs):
        url = self._url(path)
        self.log.debug(f"POST {url}")
        return self._session.post(url, json=json_body, timeout=120, **kwargs)

    def _post_raw(self, path, data, headers=None):
        url = self._url(path)
        self.log.debug(f"POST {url} ({len(data)} bytes)")
        return self._session.post(url, data=data, headers=headers, timeout=300)

    def _patch(self, path, json_body):
        url = self._url(path)
        self.log.debug(f"PATCH {url}")
        return self._session.patch(url, json=json_body, timeout=60)

    def _put(self, path, json_body=None, **kwargs):
        url = self._url(path)
        self.log.debug(f"PUT {url}")
        return self._session.put(url, json=json_body, timeout=120, **kwargs)

    def _delete(self, path):
        url = self._url(path)
        self.log.debug(f"DELETE {url}")
        return self._session.delete(url, timeout=60)

    def _get_all(self, path, params=None):
        """Paginate through all results."""
        items = []
        params = dict(params or {})
        params.setdefault("limit", 100)

        while True:
            resp = self._get(path, params)
            if resp.status_code != 200:
                raise RuntimeError(f"GET {path} failed ({resp.status_code}): {resp.text[:300]}")

            body = resp.json()
            data = body.get("data", body if isinstance(body, list) else [])
            items.extend(data)

            # Qlik pagination via links.next.href
            next_href = None
            links = body.get("links", {})
            if isinstance(links, dict) and "next" in links:
                next_href = links["next"].get("href")

            if not next_href:
                break

            # Use absolute URL for next page
            if next_href.startswith("http"):
                path = next_href.replace(self.base_url, "")
            else:
                path = next_href
            params = {}  # params are in the URL now

        return items

    # ========================================================================
    #  SPACES
    # ========================================================================

    def find_space(self, name):
        spaces = self._get_all("/api/v1/spaces", {"filter": f'name eq "{name}"'})
        return next((s for s in spaces if s.get("name") == name), None)

    def create_space(self, name, space_type):
        existing = self.find_space(name)
        if existing:
            self.log.ok(f'Space already exists: "{name}" ({existing["id"]}, type={existing["type"]})')
            return existing

        if self.dry_run:
            self.log.info(f'DRY RUN: Would create {space_type} space "{name}"')
            return {"id": "dry-run-space-id", "name": name, "type": space_type}

        resp = self._post("/api/v1/spaces", {
            "name": name,
            "type": space_type,
            "description": "Auto-created by MCG deployment script.",
        })

        if resp.status_code in (200, 201):
            space = resp.json()
            self.log.ok(f'Created {space_type} space "{name}" ({space["id"]})')
            return space
        if resp.status_code == 409:
            self.log.warn(f'Space "{name}" created concurrently — fetching.')
            return self.find_space(name)

        raise RuntimeError(f'Failed to create space "{name}" ({resp.status_code}): {resp.text[:300]}')

    # ========================================================================
    #  APPS
    # ========================================================================

    def find_app(self, name, space_id=None):
        params = {"resourceType": "app", "name": name}
        if space_id:
            params["spaceId"] = space_id
        items = self._get_all("/api/v1/items", params)
        return next((a for a in items if a.get("name") == name), None)

    def import_app(self, file_path, space_id):
        file_path = Path(file_path)
        app_name = file_path.stem

        existing = self.find_app(app_name, space_id)
        if existing:
            app_id = existing.get("resourceId", existing.get("id"))
            self.log.ok(f'App already exists: "{app_name}" ({app_id})')
            return {"id": app_id, "name": app_name, "already_existed": True}

        if self.dry_run:
            self.log.info(f'DRY RUN: Would import "{file_path.name}" into space {space_id}')
            return {"id": "dry-run-app-id", "name": app_name}

        with open(file_path, "rb") as f:
            file_data = f.read()

        resp = self._session.post(
            self._url(f"/api/v1/apps/import?spaceId={space_id}&name={app_name}"),
            data=file_data,
            headers={
                **self._session.headers,
                "Content-Type": "application/octet-stream",
            },
            timeout=300,
        )

        if resp.status_code in (200, 201):
            body = resp.json()
            app_id = body.get("attributes", {}).get("id", body.get("id"))
            self.log.ok(f'Imported app "{app_name}" ({app_id})')
            return {"id": app_id, "name": app_name}

        raise RuntimeError(f'App import failed ({resp.status_code}): {resp.text[:300]}')

    def publish_app(self, app_id, app_name, managed_space_id):
        if self.dry_run:
            self.log.info(f'DRY RUN: Would publish "{app_name}" to managed space')
            return {"id": "dry-run-pub-id"}

        resp = self._post(f"/api/v1/apps/{app_id}/publish", {
            "spaceId": managed_space_id,
            "data": "source",
        })

        if resp.status_code in (200, 201):
            body = resp.json()
            pub_id = body.get("attributes", {}).get("id", body.get("id"))
            self.log.ok(f'Published "{app_name}" (published id: {pub_id})')
            return body
        if resp.status_code == 409:
            self.log.warn(f'App "{app_name}" may already be published.')
            return {"id": app_id, "already_published": True}

        raise RuntimeError(f'Publish failed ({resp.status_code}): {resp.text[:300]}')

    # ========================================================================
    #  THEMES
    # ========================================================================

    def find_theme(self, name):
        themes = self._get_all("/api/v1/themes")
        return next((t for t in themes if t.get("name") == name), None)

    def upload_theme(self, file_path):
        file_path = Path(file_path)
        theme_name = file_path.stem.replace("-", " ").title()

        existing = self.find_theme(theme_name)
        if not existing:
            # Also check with the raw stem name and common variants
            existing = self.find_theme(file_path.stem)
        if existing:
            self.log.ok(f'Theme already exists: "{existing.get("name")}" ({existing.get("id", "?")})')
            return existing

        if self.dry_run:
            self.log.info(f'DRY RUN: Would upload theme "{file_path.name}"')
            return {"id": "dry-run-theme-id", "name": theme_name}

        with open(file_path, "rb") as f:
            resp = self._session.post(
                self._url("/api/v1/themes"),
                files={"file": (file_path.name, f, "application/zip")},
                timeout=120,
            )

        if resp.status_code in (200, 201):
            body = resp.json()
            self.log.ok(f'Uploaded theme "{body.get("name", theme_name)}" ({body.get("id", "?")})')
            return body
        if resp.status_code == 409:
            self.log.warn(f'Theme "{file_path.name}" already exists (409).')
            return {"name": theme_name, "already_exists": True}

        raise RuntimeError(f'Theme upload failed ({resp.status_code}): {resp.text[:300]}')

    # ========================================================================
    #  DATA CONNECTIONS
    # ========================================================================

    def find_connection(self, name):
        conns = self._get_all("/api/v1/data-connections")
        return next((c for c in conns if c.get("qName") == name or c.get("name") == name), None)

    def discover_datasource(self, keyword):
        """Search available data source drivers by keyword."""
        sources = self._get_all("/api/v1/data-sources")
        kw = keyword.lower()
        return next((s for s in sources if
                      kw in (s.get("sourceType") or "").lower() or
                      kw in (s.get("name") or "").lower() or
                      kw in (s.get("dataSourceType") or "").lower()), None)

    def create_connection(self, name, datasource_id, properties, space_id=None):
        existing = self.find_connection(name)
        if existing:
            conn_id = existing.get("qID", existing.get("id"))
            self.log.ok(f'Connection already exists: "{name}" ({conn_id})')
            return existing

        if self.dry_run:
            self.log.info(f'DRY RUN: Would create connection "{name}" (datasource={datasource_id})')
            return {"id": "dry-run-conn-id", "name": name}

        payload = {
            "datasourceID": datasource_id,
            "qName": name,
            "type": datasource_id,
            "qConnectStatement": "",
            **({"space": space_id} if space_id else {}),
            **properties,
        }

        resp = self._post("/api/v1/data-connections", payload)
        if resp.status_code in (200, 201):
            body = resp.json()
            self.log.ok(f'Created connection "{name}" ({body.get("qID", body.get("id"))})')
            return body
        if resp.status_code == 409:
            self.log.warn(f'Connection "{name}" already exists (409).')
            return self.find_connection(name)

        raise RuntimeError(f'Connection create failed ({resp.status_code}): {resp.text[:300]}')

    # ========================================================================
    #  KNOWLEDGE BASES (Qlik Answers)
    # ========================================================================

    def find_kb(self, name):
        kbs = self._get_all("/api/v1/knowledgebases")
        return next((kb for kb in kbs if kb.get("name") == name), None)

    def create_kb(self, name, description="", space_id=None):
        existing = self.find_kb(name)
        if existing:
            self.log.ok(f'Knowledge base already exists: "{name}" ({existing["id"]})')
            return existing

        if self.dry_run:
            self.log.info(f'DRY RUN: Would create knowledge base "{name}"')
            return {"id": "dry-run-kb-id", "name": name}

        payload = {"name": name, "description": description}
        if space_id:
            payload["spaceId"] = space_id

        resp = self._post("/api/v1/knowledgebases", payload)
        if resp.status_code in (200, 201):
            kb = resp.json()
            self.log.ok(f'Created knowledge base "{name}" ({kb["id"]})')
            return kb
        if resp.status_code == 409:
            self.log.warn(f'KB "{name}" already exists (409).')
            return self.find_kb(name)

        raise RuntimeError(f'KB create failed ({resp.status_code}): {resp.text[:300]}')

    def create_kb_datasource(self, kb_id, name):
        existing_ds = self._get_all(f"/api/v1/knowledgebases/{kb_id}/datasources")
        found = next((ds for ds in existing_ds if ds.get("name") == name), None)
        if found:
            self.log.ok(f'KB datasource already exists: "{name}" ({found["id"]})')
            return found

        if self.dry_run:
            self.log.info(f'DRY RUN: Would create KB datasource "{name}"')
            return {"id": "dry-run-ds-id", "name": name}

        resp = self._post(f"/api/v1/knowledgebases/{kb_id}/datasources", {
            "name": name,
            "type": "file",
        })
        if resp.status_code in (200, 201):
            ds = resp.json()
            self.log.ok(f'Created KB datasource "{name}" ({ds["id"]})')
            return ds
        if resp.status_code == 409:
            self.log.warn(f'KB datasource "{name}" exists (409).')
            existing_ds = self._get_all(f"/api/v1/knowledgebases/{kb_id}/datasources")
            return next((ds for ds in existing_ds if ds.get("name") == name), None)

        raise RuntimeError(f'KB datasource failed ({resp.status_code}): {resp.text[:300]}')

    def upload_document(self, kb_id, ds_id, file_path):
        file_path = Path(file_path)

        if self.dry_run:
            self.log.debug(f'DRY RUN: Would upload "{file_path.name}"')
            return {"name": file_path.name}

        mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" \
               if file_path.suffix == ".docx" else "application/octet-stream"

        with open(file_path, "rb") as f:
            resp = self._session.post(
                self._url(f"/api/v1/knowledgebases/{kb_id}/datasources/{ds_id}/files"),
                files={"file": (file_path.name, f, mime)},
                timeout=120,
            )

        if resp.status_code in (200, 201, 204):
            self.log.debug(f'Uploaded "{file_path.name}"')
            return resp.json() if resp.text else {"name": file_path.name}
        if resp.status_code == 409:
            self.log.debug(f'"{file_path.name}" already uploaded — skipping.')
            return {"name": file_path.name, "already_exists": True}

        raise RuntimeError(f'Upload "{file_path.name}" failed ({resp.status_code}): {resp.text[:200]}')

    def sync_kb(self, kb_id, ds_id):
        if self.dry_run:
            self.log.info("DRY RUN: Would trigger KB sync/indexing.")
            return

        resp = self._post(f"/api/v1/knowledgebases/{kb_id}/datasources/{ds_id}/actions/sync", {})
        if resp.status_code in (200, 201, 202, 204):
            self.log.ok("Triggered KB sync/indexing.")
            return
        raise RuntimeError(f'KB sync failed ({resp.status_code}): {resp.text[:200]}')

    # ========================================================================
    #  ASSISTANTS
    # ========================================================================

    def find_assistant(self, name):
        assistants = self._get_all("/api/v1/assistants")
        return next((a for a in assistants if a.get("name") == name), None)

    def create_assistant(self, name, description="", kb_ids=None,
                          starters=None, space_id=None):
        existing = self.find_assistant(name)
        if existing:
            self.log.ok(f'Assistant already exists: "{name}" ({existing["id"]})')
            return existing

        if self.dry_run:
            self.log.info(f'DRY RUN: Would create assistant "{name}"')
            return {"id": "dry-run-ast-id", "name": name}

        payload = {
            "name": name,
            "description": description,
            "knowledgebases": kb_ids or [],
        }
        if space_id:
            payload["spaceId"] = space_id
        if starters:
            payload["conversationStarters"] = [{"text": s} for s in starters]

        resp = self._post("/api/v1/assistants", payload)
        if resp.status_code in (200, 201):
            ast = resp.json()
            self.log.ok(f'Created assistant "{name}" ({ast["id"]})')
            return ast
        if resp.status_code == 409:
            self.log.warn(f'Assistant "{name}" exists (409).')
            return self.find_assistant(name)

        raise RuntimeError(f'Assistant create failed ({resp.status_code}): {resp.text[:300]}')

    # ========================================================================
    #  AUTOMATIONS
    # ========================================================================

    def find_automation(self, name):
        autos = self._get_all("/api/v1/automations")
        return next((a for a in autos if a.get("name") == name), None)

    def create_automation(self, name, description="", space_id=None):
        existing = self.find_automation(name)
        if existing:
            self.log.ok(f'Automation already exists: "{name}" ({existing["id"]})')
            return existing

        if self.dry_run:
            self.log.info(f'DRY RUN: Would create automation "{name}"')
            return {"id": "dry-run-auto-id", "name": name}

        payload = {
            "name": name,
            "description": description,
            "state": "disabled",  # Create disabled, user enables manually
        }
        if space_id:
            payload["spaceId"] = space_id

        resp = self._post("/api/v1/automations", payload)
        if resp.status_code in (200, 201):
            auto = resp.json()
            self.log.ok(f'Created automation "{name}" ({auto["id"]})')
            return auto
        if resp.status_code == 409:
            self.log.warn(f'Automation "{name}" exists (409).')
            return self.find_automation(name)

        raise RuntimeError(f'Automation create failed ({resp.status_code}): {resp.text[:300]}')

    # ========================================================================
    #  DATA PRODUCTS
    # ========================================================================

    def find_data_product(self, name):
        """Search for an existing data product by name."""
        try:
            products = self._get_all("/api/data-governance/data-products")
            return next((dp for dp in products if dp.get("name") == name), None)
        except Exception:
            # Governance API may not be available on all tenants
            return None

    def create_data_product(self, name, description="", tags=None,
                             owner=None, sla=None, schema=None,
                             api_sharing=False, space_id=None):
        """Create a data product via the data-governance API.

        Args:
            name:         Data product display name
            description:  Human-readable description
            tags:         List of tag strings
            owner:        Owner name (informational)
            sla:          Dict with refreshFrequency, availability, trustScoreTarget
            schema:       List of dicts with name, type, description for each field
            api_sharing:  Whether to enable API consumption
            space_id:     Target space ID
        """
        existing = self.find_data_product(name)
        if existing:
            self.log.ok(f'Data product already exists: "{name}" ({existing.get("id", "?")})')
            return existing

        if self.dry_run:
            self.log.info(f'DRY RUN: Would create data product "{name}"')
            return {"id": "dry-run-dp-id", "name": name}

        payload = {
            "name": name,
            "description": description,
        }
        if space_id:
            payload["spaceId"] = space_id
        if tags:
            payload["tags"] = tags
        if owner:
            payload["owner"] = owner
        if sla:
            payload["sla"] = sla
        if schema:
            payload["schema"] = schema
        if api_sharing:
            payload["apiSharing"] = {"enabled": True}

        resp = self._post("/api/data-governance/data-products", payload)
        if resp.status_code in (200, 201):
            dp = resp.json()
            self.log.ok(f'Created data product "{name}" ({dp.get("id", "?")})')
            return dp
        if resp.status_code == 409:
            self.log.warn(f'Data product "{name}" may already exist.')
            return {"name": name, "already_exists": True}
        if resp.status_code == 404:
            self.log.warn(f'Data products API not available (404). '
                          f'Talend Enterprise tier may be required for "{name}".')
            return {"name": name, "not_available": True}

        raise RuntimeError(f'Data product create failed ({resp.status_code}): {resp.text[:300]}')

    # ========================================================================
    #  BUSINESS GLOSSARY
    # ========================================================================

    def find_glossary(self, name):
        """Search for an existing glossary by name."""
        try:
            glossaries = self._get_all("/api/data-governance/glossaries")
            return next((g for g in glossaries if g.get("name") == name), None)
        except Exception:
            return None

    def create_glossary(self, name, description=""):
        """Create a business glossary container."""
        existing = self.find_glossary(name)
        if existing:
            self.log.ok(f'Glossary already exists: "{name}" ({existing.get("id", "?")})')
            return existing

        if self.dry_run:
            self.log.info(f'DRY RUN: Would create glossary "{name}"')
            return {"id": "dry-run-glossary-id", "name": name}

        resp = self._post("/api/data-governance/glossaries", {
            "name": name,
            "description": description,
        })
        if resp.status_code in (200, 201):
            g = resp.json()
            self.log.ok(f'Created glossary "{name}" ({g.get("id", "?")})')
            return g
        if resp.status_code == 409:
            self.log.warn(f'Glossary "{name}" may already exist.')
            return self.find_glossary(name) or {"name": name, "already_exists": True}
        if resp.status_code == 404:
            self.log.warn("Glossaries API not available (404). "
                          "Talend Enterprise tier may be required.")
            return {"name": name, "not_available": True}

        raise RuntimeError(f'Glossary create failed ({resp.status_code}): {resp.text[:300]}')

    def create_glossary_term(self, glossary_id, name, definition="",
                              category="", tags=None):
        """Create a term within a business glossary."""
        if self.dry_run:
            self.log.debug(f'DRY RUN: Would create glossary term "{name}"')
            return {"id": "dry-run-term-id", "name": name}

        payload = {
            "name": name,
            "definition": definition,
        }
        if category:
            payload["category"] = category
        if tags:
            payload["tags"] = tags

        resp = self._post(f"/api/data-governance/glossaries/{glossary_id}/terms", payload)
        if resp.status_code in (200, 201):
            term = resp.json()
            self.log.debug(f'Created term "{name}" ({term.get("id", "?")})')
            return term
        if resp.status_code == 409:
            self.log.debug(f'Term "{name}" already exists — skipping.')
            return {"name": name, "already_exists": True}

        raise RuntimeError(f'Term "{name}" create failed ({resp.status_code}): {resp.text[:200]}')


# ---------------------------------------------------------------------------
#  Deployment Report
# ---------------------------------------------------------------------------

class DeployReport:
    def __init__(self):
        self.steps = []
        self._start = time.time()

    def record(self, step, status, detail=""):
        self.steps.append({
            "step": step,
            "status": status,
            "detail": detail,
            "time": datetime.now().isoformat(),
        })

    def print_summary(self, log):
        elapsed = time.time() - self._start
        log.section("DEPLOYMENT SUMMARY")

        max_step = max((len(s["step"]) for s in self.steps), default=10)
        header = f"{'Step'.ljust(max_step + 2)}{'Status'.ljust(10)}Detail"
        print(header)
        print("-" * (len(header) + 20))

        ok = fail = skip = 0
        for s in self.steps:
            icon = s["status"]
            print(f"{s['step'].ljust(max_step + 2)}{icon.ljust(10)}{s['detail']}")
            if icon == "OK":   ok += 1
            if icon == "FAIL": fail += 1
            if icon == "SKIP": skip += 1

        print("-" * (len(header) + 20))
        print(f"Total: {len(self.steps)} steps | OK: {ok} | Failed: {fail} | Skipped: {skip} | Duration: {elapsed:.1f}s\n")
        return fail


def print_checklist(report, enabled, log):
    """Print a post-deployment checklist of manual steps still required.

    Maps each automated component to any follow-up UI configuration
    steps that cannot be done via API.
    """
    log.section("POST-DEPLOYMENT CHECKLIST")

    # Determine which components succeeded
    ok_steps = {s["step"].lower() for s in report.steps if s["status"] == "OK"}

    # Manual steps keyed by component — only shown if that component deployed OK
    manual_steps = {
        "infrastructure": [
            "Verify Kafka broker is reachable: docker compose ps (or check your cluster)",
            "Verify topics exist: docker compose exec kafka kafka-topics --bootstrap-server kafka:9092 --list",
            "Start the IoT simulator: python simulators/kafka_iot_simulator.py --bootstrap-servers localhost:9092",
        ],
        "spaces": [
            "Assign users/groups to shared and managed spaces",
            "Verify space permissions for demo presenters",
        ],
        "connections": [
            "Test each data connection (click 'Test Connection' in the UI)",
            "Verify tables/topics are visible through each connection",
            "Configure CDC Cluster for PostgreSQL + Salesforce pipelines",
            "Configure Streaming Cluster for Kafka IoT pipelines",
        ],
        "theme": [
            "Apply MCG Dark Theme to both analytics apps (App Settings → Theme)",
            "Verify MCG logo appears in app headers",
        ],
        "apps": [
            "Open both domain apps and verify data loads correctly:",
            "  • MCG Supply Chain Operations (5 Gold tables + streaming IoT)",
            "  • MCG Delivery & Customer Experience (3 Gold tables + streaming carrier events)",
            "Set up scheduled reloads (every 5 min for streaming data)",
            "Configure Business Logic for Qlik Answers in each app",
            "Publish apps from Development → Published space",
        ],
        "knowledge": [
            "Wait for document indexing to complete (5-10 min)",
            "Verify upload count matches expected 25 documents",
        ],
        "assistant": [
            "Test each conversation starter in the Qlik Answers UI",
            "Verify answers reference correct source documents",
        ],
        "automations": [
            "Open each automation in the Automation Designer",
            "Configure block details (see deploy/automation_guide.md)",
            "Set Teams webhook URLs in webhook blocks",
            "Configure Talend Address Correction automation trigger (new stewardship tasks → run Talend job)",
            "Enable automations and test with 'Run Now'",
        ],
        "dataproducts": [
            "Verify data products have data flowing from Gold tables",
            "Enable API sharing for key data products (governance capability)",
            "Review AI-Driven Descriptions and column-level metadata",
            "Review Semantic Types and AI-Suggested Validation Rules",
            "Configure refresh schedules",
        ],
        "glossary": [
            "Review and approve glossary terms",
            "Link terms to relevant data products and datasets",
        ],
    }

    # Always-shown manual steps (not tied to a specific component)
    always_manual = [
        ("Open Lakehouse",      "Configure Bronze/Silver/Gold layers in Qlik Cloud UI (see creation_guide.md §1)"),
        ("Data Flows",          "Build 8 transformation flows + Talend address validation job (see creation_guide.md §1.3)"),
        ("Table Recipes",       "Create 7 Gold-layer table recipes from Silver tables (see creation_guide.md §1.4)"),
        ("Qlik Predict",       "Create AutoML experiments for Spoilage Risk & SLA Prediction (see creation_guide.md §4)"),
        ("Stewardship",         "Create 4 stewardship campaigns (see demo_checklist.md Phase 8)"),
        ("Discovery Agent",     "Enable Discovery Agent on data products and set alert thresholds"),
        ("MCP Server",          "Install and configure Qlik MCP server (see setup_guide.md §13)"),
    ]

    idx = 1

    # Component-specific manual follow-ups
    for key, label in COMPONENTS:
        if not enabled.get(key, False):
            continue
        steps = manual_steps.get(key, [])
        # Only show if the component deployed successfully
        component_ok = any(key in s for s in ok_steps)
        if not steps or not component_ok:
            continue
        print(f"\n  {label}:")
        for step in steps:
            print(f"    {idx:>2}. [ ] {step}")
            idx += 1

    # Always-needed manual steps
    print("\n  Manual Configuration (UI-only — not automated):")
    for label, desc in always_manual:
        print(f"    {idx:>2}. [ ] {label}: {desc}")
        idx += 1

    print(f"\n  Total manual steps remaining: {idx - 1}")
    print(f"  See deploy/demo_checklist.md for the full 13-phase checklist.\n")


# ---------------------------------------------------------------------------
#  File discovery
# ---------------------------------------------------------------------------

def find_files(directory, extension):
    """Recursively find files with given extension."""
    directory = Path(directory)
    if not directory.exists():
        return []
    return sorted(directory.rglob(f"*{extension}"))


# ---------------------------------------------------------------------------
#  Connection property builders
# ---------------------------------------------------------------------------

def build_postgres_props(cfg):
    return {
        "qConnectStatement": (
            f'CUSTOM CONNECT TO "provider=QvOdbcConnectorPackage.exe;'
            f'driver=postgresql;server={cfg["host"]};port={cfg["port"]};'
            f'database={cfg["database"]};sslmode=require"'
        ),
        "qUsername": cfg["username"],
        "qPassword": cfg["password"],
    }

def build_salesforce_props(cfg):
    return {
        "connectionProperties": {
            "username": cfg["username"],
            "password": cfg["password"],
            "securityToken": cfg["securityToken"],
            "isSandbox": cfg.get("isSandbox", False),
        },
    }

def build_s3_props(cfg):
    return {
        "connectionProperties": {
            "bucketName": cfg["bucketName"],
            "region": cfg["region"],
            "accessKeyId": cfg["accessKeyId"],
            "secretAccessKey": cfg["secretAccessKey"],
            "prefix": cfg.get("prefix", ""),
        },
    }

def build_kafka_props(cfg):
    topics = cfg.get("topics", [])
    if isinstance(topics, str):
        topics = [topics]
    return {
        "connectionProperties": {
            "bootstrapServers": cfg.get("bootstrapServers", ""),
            "topics": ",".join(topics),
            "securityProtocol": cfg.get("securityProtocol", "SASL_SSL"),
            "saslMechanism": cfg.get("saslMechanism", "PLAIN"),
            "saslUsername": cfg.get("saslUsername", ""),
            "saslPassword": cfg.get("saslPassword", ""),
        },
    }


CONNECTION_DEFS = [
    ("postgresql",  "postgres",    build_postgres_props,   "PostgreSQL (MCG WMS)"),
    ("salesforce",  "salesforce",  build_salesforce_props,  "Salesforce (MCG CRM)"),
    ("kafka",       "kafka",       build_kafka_props,       "Kafka (MCG IoT Telemetry)"),
    ("s3",          "s3",          build_s3_props,          "S3 (File Storage)"),
]


# ---------------------------------------------------------------------------
#  Kafka Infrastructure (Docker Compose + standalone topic creation)
# ---------------------------------------------------------------------------

DOCKER_COMPOSE_FILE = INFRASTRUCTURE_DIR / "docker-compose.yml"

MCG_TOPICS = [
    {
        "name": "mcg.iot.cold-chain",
        "partitions": 3,
        "replication_factor": 1,
        "retention_ms": 604800000,       # 7 days
        "description": "Cold chain IoT sensor readings (~1 msg/5s per sensor)",
    },
    {
        "name": "mcg.iot.carrier-events",
        "partitions": 3,
        "replication_factor": 1,
        "retention_ms": 2592000000,      # 30 days
        "description": "Carrier status update events (~1 msg/min)",
    },
]


def check_docker():
    """Return True if docker and docker compose are available."""
    if not shutil.which("docker"):
        return False
    try:
        result = subprocess.run(
            ["docker", "compose", "version"],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0
    except Exception:
        return False


def kafka_docker_status(log):
    """Check whether the MCG Kafka stack is already running."""
    if not DOCKER_COMPOSE_FILE.exists():
        return "not_found"
    try:
        result = subprocess.run(
            ["docker", "compose", "-f", str(DOCKER_COMPOSE_FILE), "ps", "--format", "json"],
            capture_output=True, text=True, timeout=15,
            cwd=str(INFRASTRUCTURE_DIR),
        )
        if result.returncode != 0:
            return "stopped"
        output = result.stdout.strip()
        if not output:
            return "stopped"
        # Check if kafka broker is running
        if "kafka" in output.lower() and "running" in output.lower():
            return "running"
        return "stopped"
    except Exception:
        return "stopped"


def start_kafka_docker(log, dry_run=False):
    """Start the Confluent Kafka stack via Docker Compose."""
    if not DOCKER_COMPOSE_FILE.exists():
        log.error(f"Docker Compose file not found: {DOCKER_COMPOSE_FILE}")
        return False

    if dry_run:
        log.info("DRY RUN: Would run 'docker compose up -d' for Kafka infrastructure.")
        return True

    log.info("Starting Confluent Kafka stack (ZooKeeper, Broker, Schema Registry, Control Center)...")
    try:
        result = subprocess.run(
            ["docker", "compose", "-f", str(DOCKER_COMPOSE_FILE), "up", "-d"],
            capture_output=True, text=True, timeout=120,
            cwd=str(INFRASTRUCTURE_DIR),
        )
        if result.returncode != 0:
            log.error(f"Docker Compose failed:\n{result.stderr}")
            return False

        log.ok("Kafka stack started. Waiting for broker to become healthy...")

        # Wait for broker to be healthy (up to 60 seconds)
        for i in range(12):
            time.sleep(5)
            status = kafka_docker_status(log)
            if status == "running":
                log.ok("Kafka broker is healthy.")
                log.info("Topics mcg.iot.cold-chain and mcg.iot.carrier-events created by init container.")
                log.info("Confluent Control Center available at http://localhost:9021")
                return True
            log.debug(f"Waiting for broker... ({(i+1)*5}s)")

        log.warn("Broker may still be starting — check 'docker compose logs kafka'.")
        return True

    except subprocess.TimeoutExpired:
        log.error("Docker Compose timed out after 120 seconds.")
        return False
    except Exception as e:
        log.error(f"Docker Compose error: {e}")
        return False


def stop_kafka_docker(log):
    """Stop the Confluent Kafka stack."""
    if not DOCKER_COMPOSE_FILE.exists():
        return
    try:
        subprocess.run(
            ["docker", "compose", "-f", str(DOCKER_COMPOSE_FILE), "down"],
            capture_output=True, text=True, timeout=60,
            cwd=str(INFRASTRUCTURE_DIR),
        )
        log.ok("Kafka stack stopped.")
    except Exception as e:
        log.warn(f"Could not stop Kafka stack: {e}")


def create_kafka_topics_standalone(bootstrap_servers, log, dry_run=False):
    """Create MCG Kafka topics using kafka-topics CLI (no Docker required).

    This is the fallback for users who have their own Kafka cluster
    (e.g., Confluent Cloud, Amazon MSK, self-managed) and don't need
    the Docker Compose stack.

    Requires: confluent-kafka Python package or kafka-topics CLI on PATH.
    """
    log.info(f"Creating MCG topics on external broker: {bootstrap_servers}")

    # Try kafka-topics CLI first (available if Kafka is installed locally)
    kafka_topics_cmd = shutil.which("kafka-topics") or shutil.which("kafka-topics.sh")

    if kafka_topics_cmd:
        return _create_topics_via_cli(kafka_topics_cmd, bootstrap_servers, log, dry_run)

    # Fallback: try confluent-kafka Python AdminClient
    try:
        from confluent_kafka.admin import AdminClient, NewTopic
        return _create_topics_via_python(bootstrap_servers, log, dry_run)
    except ImportError:
        pass

    log.error(
        "Cannot create topics: neither 'kafka-topics' CLI nor "
        "'confluent-kafka' Python package found.\n"
        "  Option A: pip install confluent-kafka\n"
        "  Option B: Install Kafka CLI tools (kafka-topics.sh)\n"
        "  Option C: Use the Docker Compose stack (infrastructure/kafka/)\n"
        "  Option D: Create topics manually in your Kafka management console."
    )
    return False


def _create_topics_via_cli(kafka_topics_cmd, bootstrap_servers, log, dry_run):
    """Create topics using kafka-topics CLI."""
    for topic in MCG_TOPICS:
        cmd = [
            kafka_topics_cmd,
            "--bootstrap-server", bootstrap_servers,
            "--create", "--if-not-exists",
            "--topic", topic["name"],
            "--partitions", str(topic["partitions"]),
            "--replication-factor", str(topic["replication_factor"]),
            "--config", f"retention.ms={topic['retention_ms']}",
        ]
        if dry_run:
            log.info(f"DRY RUN: Would run: {' '.join(cmd)}")
            continue
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                log.ok(f"Topic '{topic['name']}' created ({topic['description']})")
            else:
                log.error(f"Failed to create '{topic['name']}': {result.stderr.strip()}")
                return False
        except Exception as e:
            log.error(f"kafka-topics error for '{topic['name']}': {e}")
            return False
    return True


def _create_topics_via_python(bootstrap_servers, log, dry_run):
    """Create topics using confluent-kafka Python AdminClient."""
    from confluent_kafka.admin import AdminClient, NewTopic

    if dry_run:
        for topic in MCG_TOPICS:
            log.info(f"DRY RUN: Would create topic '{topic['name']}' "
                     f"(partitions={topic['partitions']}, "
                     f"retention={topic['retention_ms']}ms)")
        return True

    admin = AdminClient({"bootstrap.servers": bootstrap_servers})

    new_topics = [
        NewTopic(
            topic["name"],
            num_partitions=topic["partitions"],
            replication_factor=topic["replication_factor"],
            config={"retention.ms": str(topic["retention_ms"])},
        )
        for topic in MCG_TOPICS
    ]

    futures = admin.create_topics(new_topics)
    success = True
    for topic_name, future in futures.items():
        try:
            future.result()  # blocks until topic is created
            desc = next((t["description"] for t in MCG_TOPICS if t["name"] == topic_name), "")
            log.ok(f"Topic '{topic_name}' created ({desc})")
        except Exception as e:
            if "already exists" in str(e).lower():
                log.info(f"Topic '{topic_name}' already exists — OK.")
            else:
                log.error(f"Failed to create '{topic_name}': {e}")
                success = False
    return success


# ---------------------------------------------------------------------------
#  Main deployment orchestrator
# ---------------------------------------------------------------------------

def run_deployment(cfg, log, dry_run=False):
    """Execute the deployment pipeline."""
    report = DeployReport()
    enabled = cfg.get("enabledComponents", {})
    continue_on_error = cfg.get("options", {}).get("continueOnError", True)

    client = QlikClient(cfg, log, dry_run)
    log.info(f"Target: {client.base_url}")
    if dry_run:
        log.warn("DRY RUN MODE — no changes will be made to Qlik Cloud.")

    all_components = ["infrastructure", "spaces", "connections", "theme", "apps",
                      "knowledge", "assistant", "automations", "dataproducts", "glossary"]
    total_steps = sum(1 for k in all_components if enabled.get(k, True))
    current_step = 0

    # --- Step: Kafka Infrastructure (Docker or standalone topic creation) ---
    if enabled.get("infrastructure", True):
        current_step += 1
        log.step(current_step, total_steps, "Kafka Infrastructure")

        kafka_cfg = cfg.get("dataConnections", {}).get("kafka", {})
        infra_cfg = cfg.get("infrastructure", {})
        use_docker = infra_cfg.get("useDocker", True)
        bootstrap = kafka_cfg.get("bootstrapServers", "localhost:9092")

        if use_docker:
            has_docker = check_docker()
            if not has_docker:
                log.warn("Docker not found on PATH — skipping Docker Compose.")
                log.info("To create topics on an external broker, set "
                         "infrastructure.useDocker = false in config.")
                report.record("Kafka Infrastructure", "SKIP",
                              "Docker not available")
            else:
                status = kafka_docker_status(log)
                if status == "running":
                    log.ok("Kafka Docker stack is already running.")
                    report.record("Kafka Infrastructure", "OK",
                                  "Already running")
                else:
                    ok = start_kafka_docker(log, dry_run=dry_run)
                    report.record("Kafka Infrastructure",
                                  "OK" if ok else "FAIL",
                                  "Docker Compose started" if ok else "Failed to start")
                    if not ok and not continue_on_error:
                        report.print_summary(log)
                        return 1
        else:
            # Standalone topic creation on external broker
            if not bootstrap or bootstrap in ("localhost:9092", "your-kafka-broker:9092"):
                log.warn("No external Kafka broker configured — skipping topic creation.")
                log.info("Set dataConnections.kafka.bootstrapServers in config.")
                report.record("Kafka Topics", "SKIP", "No broker configured")
            else:
                ok = create_kafka_topics_standalone(bootstrap, log, dry_run=dry_run)
                report.record("Kafka Topics",
                              "OK" if ok else "FAIL",
                              f"Broker: {bootstrap}")
                if not ok and not continue_on_error:
                    report.print_summary(log)
                    return 1

    # --- Authenticate ---
    log.section("Authentication")
    try:
        client.authenticate()
        if not client.verify_connection():
            raise RuntimeError("Could not verify connection to Qlik Cloud tenant.")
        report.record("Authentication", "OK", f"method={cfg['auth']['method']}")
    except Exception as e:
        log.error(f"Authentication failed: {e}")
        report.record("Authentication", "FAIL", str(e))
        report.print_summary(log)
        return 1

    shared_space = None
    managed_space = None

    # --- Step: Spaces ---
    if enabled.get("spaces", True):
        current_step += 1
        log.step(current_step, total_steps, "Create Spaces")
        try:
            shared_name = cfg.get("spaces", {}).get("shared", "MCG Demo - Development")
            managed_name = cfg.get("spaces", {}).get("managed", "MCG Demo - Published")

            shared_space = client.create_space(shared_name, "shared")
            report.record("Space (shared)", "OK", f'"{shared_name}" id={shared_space["id"]}')

            managed_space = client.create_space(managed_name, "managed")
            report.record("Space (managed)", "OK", f'"{managed_name}" id={managed_space["id"]}')
        except Exception as e:
            log.error(f"Space creation failed: {e}")
            report.record("Spaces", "FAIL", str(e))
            if not continue_on_error:
                report.print_summary(log)
                return 1

    # --- Step: Data Connections ---
    if enabled.get("connections", True):
        current_step += 1
        log.step(current_step, total_steps, "Create Data Connections")
        conns_cfg = cfg.get("dataConnections", {})

        for key, keyword, builder, label in CONNECTION_DEFS:
            conn_cfg = conns_cfg.get(key)
            if not conn_cfg:
                log.warn(f"No config for {label} — skipping.")
                report.record(f"Connection: {label}", "SKIP", "Not configured")
                continue

            try:
                log.info(f"Discovering data source type: {keyword}")
                ds = client.discover_datasource(keyword)
                ds_id = ds.get("dataSourceType", ds.get("sourceType", keyword)) if ds else keyword
                if ds:
                    log.debug(f"Found: {ds.get('name', ds_id)}")
                else:
                    log.warn(f'Data source "{keyword}" not found — using keyword as fallback.')

                props = builder(conn_cfg)
                space_id = shared_space["id"] if shared_space else None
                client.create_connection(conn_cfg.get("name", f"MCG {label}"), ds_id, props, space_id)
                report.record(f"Connection: {label}", "OK", conn_cfg.get("name", ""))
            except Exception as e:
                log.error(f"{label}: {e}")
                report.record(f"Connection: {label}", "FAIL", str(e))
                if not continue_on_error:
                    report.print_summary(log)
                    return 1

    # --- Step: Theme ---
    if enabled.get("theme", True):
        current_step += 1
        log.step(current_step, total_steps, "Upload MCG Dark Theme")

        theme_zip = THEMES_DIR / "mcg-dark-theme.zip"
        if theme_zip.exists():
            try:
                client.upload_theme(theme_zip)
                report.record("Theme Upload", "OK", f'"{theme_zip.name}"')
            except Exception as e:
                log.error(f"Theme upload failed: {e}")
                report.record("Theme Upload", "FAIL", str(e))
                if not continue_on_error:
                    report.print_summary(log)
                    return 1
        else:
            log.warn(f"Theme file not found: {theme_zip}")
            report.record("Theme Upload", "SKIP", "mcg-dark-theme.zip not found")

    # --- Step: Apps ---
    if enabled.get("apps", True):
        current_step += 1
        log.step(current_step, total_steps, "Import & Publish Analytics Apps")

        qvf_files = find_files(APPS_DIR, ".qvf")
        if not qvf_files:
            log.warn(f"No .qvf files found in {APPS_DIR} — skipping.")
            report.record("App import", "SKIP", "No .qvf files found")
        else:
            log.info(f"Found {len(qvf_files)} .qvf file(s).")
            for qvf in qvf_files:
                try:
                    space_id = shared_space["id"] if shared_space else None
                    app = client.import_app(qvf, space_id)
                    report.record(f'Import "{qvf.stem}"', "OK", f'id={app["id"]}')

                    if managed_space and not app.get("already_existed"):
                        client.publish_app(app["id"], qvf.stem, managed_space["id"])
                        report.record(f'Publish "{qvf.stem}"', "OK", "Published to managed space")
                    elif app.get("already_existed"):
                        report.record(f'Publish "{qvf.stem}"', "SKIP", "Already existed")
                except Exception as e:
                    log.error(f'App "{qvf.stem}": {e}')
                    report.record(f'App "{qvf.stem}"', "FAIL", str(e))
                    if not continue_on_error:
                        report.print_summary(log)
                        return 1

    # --- Step: Knowledge Base ---
    kb = None
    kb_ds = None
    if enabled.get("knowledge", True):
        current_step += 1
        log.step(current_step, total_steps, "Create Knowledge Base & Upload Documents")

        try:
            kb_cfg = cfg.get("knowledgeBase", {})
            kb_name = kb_cfg.get("name", "MCG Operations Knowledge Base")
            kb_desc = kb_cfg.get("description", "")
            space_id = shared_space["id"] if shared_space else None

            kb = client.create_kb(kb_name, kb_desc, space_id)
            report.record("Knowledge Base", "OK", f'"{kb_name}" id={kb["id"]}')

            kb_ds = client.create_kb_datasource(kb["id"], "MCG Documents")
            report.record("KB Datasource", "OK", f'id={kb_ds["id"]}')

            # Upload documents
            docx_files = find_files(DOCUMENTS_DIR, ".docx")
            pptx_files = find_files(DOCUMENTS_DIR, ".pptx")
            # Also check project root for standalone PPTX
            root_pptx = find_files(PROJECT_DIR, ".pptx")
            all_files = docx_files + pptx_files + root_pptx

            if not all_files:
                log.warn(f"No documents found in {DOCUMENTS_DIR}")
                report.record("Document Upload", "SKIP", "No files found")
            else:
                log.info(f"Uploading {len(all_files)} document(s)...")
                uploaded = failed = 0
                for doc_path in all_files:
                    try:
                        client.upload_document(kb["id"], kb_ds["id"], doc_path)
                        uploaded += 1
                    except Exception as e:
                        log.error(f'Upload failed for "{doc_path.name}": {e}')
                        failed += 1
                        if not continue_on_error:
                            raise

                log.ok(f"Uploaded {uploaded}/{len(all_files)} documents ({failed} failed).")
                report.record("Document Upload",
                              "OK" if failed == 0 else "FAIL",
                              f"{uploaded} uploaded, {failed} failed")

            # Trigger sync
            log.info("Triggering knowledge base sync/indexing...")
            client.sync_kb(kb["id"], kb_ds["id"])
            report.record("KB Sync", "OK", "Indexing triggered")

        except Exception as e:
            log.error(f"Knowledge base setup failed: {e}")
            report.record("Knowledge Base", "FAIL", str(e))
            if not continue_on_error:
                report.print_summary(log)
                return 1

    # --- Step: Assistant ---
    if enabled.get("assistant", True):
        current_step += 1
        log.step(current_step, total_steps, "Create Qlik Answers Assistant")

        try:
            ast_cfg = cfg.get("assistant", {})
            kb_ids = [kb["id"]] if kb else []
            space_id = shared_space["id"] if shared_space else None

            client.create_assistant(
                name=ast_cfg.get("name", "MCG Operations Assistant"),
                description=ast_cfg.get("description", "AI assistant for MCG operations."),
                kb_ids=kb_ids,
                starters=ast_cfg.get("conversationStarters", [
                    "What is the procedure for goods receiving?",
                    "What happened during the Rotterdam pipeline failure?",
                    "What are the cold chain temperature requirements?",
                    "What is Project CLARITY?",
                    "What was the lettuce recall and what went wrong?",
                ]),
                space_id=space_id,
            )
            report.record("Assistant", "OK", ast_cfg.get("name", "MCG Operations Assistant"))
        except Exception as e:
            log.error(f"Assistant creation failed: {e}")
            report.record("Assistant", "FAIL", str(e))
            if not continue_on_error:
                report.print_summary(log)
                return 1

    # --- Step: Automations ---
    if enabled.get("automations", True):
        current_step += 1
        log.step(current_step, total_steps, "Create Automations")

        space_id = shared_space["id"] if shared_space else None

        # Built-in automation definitions (always created)
        automation_defs = [
            ("MCG Daily App Reload",
             "Scheduled daily reload of MCG analytics apps at 06:00 UTC."),
            ("MCG Address Correction — Talend Job Trigger",
             "Triggered by new Stewardship tasks in the Address Cleanup campaign. "
             "Runs the Talend Address Validation Service job (tAddressRowStandardize, "
             "tAddressRowValidate, tGeocode) on flagged records, writes corrected "
             "addresses back to silver.customers_deduped, and resolves the stewardship task."),
        ]

        # Load additional automations from JSON templates in automations/ directory
        if AUTOMATIONS_DIR.exists():
            template_files = sorted(AUTOMATIONS_DIR.glob("*.json"))
            if template_files:
                log.info(f"Found {len(template_files)} automation template(s) in {AUTOMATIONS_DIR.name}/")
            for tpl_path in template_files:
                try:
                    tpl = json.loads(tpl_path.read_text(encoding="utf-8"))
                    tpl_name = tpl.get("name", tpl_path.stem)
                    tpl_desc = tpl.get("description", "")
                    # Avoid duplicating built-in definitions
                    if not any(name == tpl_name for name, _ in automation_defs):
                        automation_defs.append((tpl_name, tpl_desc))
                        log.debug(f'Loaded template: "{tpl_name}" from {tpl_path.name}')
                except Exception as e:
                    log.warn(f'Could not parse automation template "{tpl_path.name}": {e}')

        for auto_name, auto_desc in automation_defs:
            try:
                client.create_automation(auto_name, auto_desc, space_id)
                report.record(f"Automation: {auto_name}", "OK", "Created (disabled)")
            except Exception as e:
                log.error(f"Automation '{auto_name}': {e}")
                report.record(f"Automation: {auto_name}", "FAIL", str(e))
                if not continue_on_error:
                    report.print_summary(log)
                    return 1

        log.info("Automations created in DISABLED state — configure triggers in Qlik Cloud console.")

    # --- Step: Data Products ---
    if enabled.get("dataproducts", True):
        current_step += 1
        log.step(current_step, total_steps, "Create Data Products (Gold Layer)")

        if DATA_PRODUCTS_FILE.exists():
            try:
                dp_data = json.loads(DATA_PRODUCTS_FILE.read_text(encoding="utf-8"))
                products = dp_data.get("dataProducts", [])
                log.info(f"Found {len(products)} data product definition(s) in {DATA_PRODUCTS_FILE.name}")
                space_id = shared_space["id"] if shared_space else None

                created = skipped = failed_dp = 0
                for dp_def in products:
                    try:
                        result = client.create_data_product(
                            name=dp_def["name"],
                            description=dp_def.get("description", ""),
                            tags=dp_def.get("tags"),
                            owner=dp_def.get("owner"),
                            sla=dp_def.get("sla"),
                            schema=dp_def.get("schema"),
                            api_sharing=dp_def.get("apiSharing", False),
                            space_id=space_id,
                        )
                        if result.get("not_available"):
                            skipped += 1
                        elif result.get("already_exists"):
                            skipped += 1
                        else:
                            created += 1
                    except Exception as e:
                        log.error(f'Data product "{dp_def["name"]}": {e}')
                        failed_dp += 1
                        if not continue_on_error:
                            raise

                log.ok(f"Data products: {created} created, {skipped} skipped, {failed_dp} failed.")
                report.record("Data Products",
                              "OK" if failed_dp == 0 else "FAIL",
                              f"{created} created, {skipped} skipped, {failed_dp} failed")
            except Exception as e:
                log.error(f"Data products step failed: {e}")
                report.record("Data Products", "FAIL", str(e))
                if not continue_on_error:
                    report.print_summary(log)
                    return 1
        else:
            log.warn(f"{DATA_PRODUCTS_FILE.name} not found — skipping data products.")
            report.record("Data Products", "SKIP", "No definitions file found")

    # --- Step: Business Glossary ---
    if enabled.get("glossary", True):
        current_step += 1
        log.step(current_step, total_steps, "Create Business Glossary Terms")

        if GLOSSARY_FILE.exists():
            try:
                gl_data = json.loads(GLOSSARY_FILE.read_text(encoding="utf-8"))
                gl_meta = gl_data.get("glossary", {})
                terms = gl_data.get("terms", [])
                log.info(f"Found {len(terms)} glossary term(s) in {GLOSSARY_FILE.name}")

                # Create glossary container
                glossary = client.create_glossary(
                    name=gl_meta.get("name", "MCG Supply Chain Glossary"),
                    description=gl_meta.get("description", ""),
                )

                if glossary.get("not_available"):
                    log.warn("Glossary API not available — skipping terms.")
                    report.record("Glossary", "SKIP", "API not available (requires Talend Enterprise)")
                else:
                    glossary_id = glossary.get("id", "")
                    report.record("Glossary",
                                  "OK" if glossary_id else "SKIP",
                                  f'"{gl_meta.get("name", "")}" id={glossary_id}')

                    # Create terms
                    if glossary_id and glossary_id not in ("dry-run-glossary-id",):
                        created_t = failed_t = 0
                        for term in terms:
                            try:
                                client.create_glossary_term(
                                    glossary_id=glossary_id,
                                    name=term["name"],
                                    definition=term.get("definition", ""),
                                    category=term.get("category", ""),
                                    tags=term.get("tags"),
                                )
                                created_t += 1
                            except Exception as e:
                                log.error(f'Term "{term["name"]}": {e}')
                                failed_t += 1
                                if not continue_on_error:
                                    raise

                        log.ok(f"Glossary terms: {created_t} created, {failed_t} failed.")
                        report.record("Glossary Terms",
                                      "OK" if failed_t == 0 else "FAIL",
                                      f"{created_t}/{len(terms)} terms")
                    elif glossary_id == "dry-run-glossary-id":
                        log.info(f"DRY RUN: Would create {len(terms)} glossary terms.")
                        report.record("Glossary Terms", "OK",
                                      f"DRY RUN: {len(terms)} terms")

            except Exception as e:
                log.error(f"Glossary step failed: {e}")
                report.record("Glossary", "FAIL", str(e))
                if not continue_on_error:
                    report.print_summary(log)
                    return 1
        else:
            log.warn(f"{GLOSSARY_FILE.name} not found — skipping glossary.")
            report.record("Glossary", "SKIP", "No definitions file found")

    # --- Final Report ---
    failures = report.print_summary(log)

    # --- Post-Deployment Checklist ---
    print_checklist(report, enabled, log)

    if failures > 0:
        log.warn(f"Deployment completed with {failures} failure(s).")
        return 1
    else:
        log.ok("Deployment completed successfully!")
        return 0


# ---------------------------------------------------------------------------
#  CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Deploy Meridian Commerce Group demo to Qlik Cloud.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python deploy_qlik.py                        # Interactive wizard
  python deploy_qlik.py --config config.json   # Use saved config
  python deploy_qlik.py --dry-run              # Preview mode
  python deploy_qlik.py --skip-prompts         # Auto-run from config
        """,
    )
    parser.add_argument("--config", type=str, default=None,
                         help="Path to config JSON file")
    parser.add_argument("--dry-run", action="store_true",
                         help="Preview actions without making API calls")
    parser.add_argument("--verbose", action="store_true",
                         help="Enable detailed logging")
    parser.add_argument("--skip-prompts", action="store_true",
                         help="Skip interactive prompts, use config file as-is")

    args = parser.parse_args()

    # Load existing config if available
    config_path = Path(args.config) if args.config else CONFIG_PATH
    existing_config = None
    if config_path.exists():
        try:
            existing_config = json.loads(config_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    # Apply environment variable overrides
    env_overrides = {
        "QLIK_TENANT_HOST": ("tenant", "hostname"),
        "QLIK_REGION": ("tenant", "region"),
        "QLIK_API_KEY": ("auth", "apiKey"),
        "QLIK_AUTH_METHOD": ("auth", "method"),
    }
    if existing_config:
        for env_var, (section, key) in env_overrides.items():
            val = os.environ.get(env_var)
            if val:
                existing_config.setdefault(section, {})[key] = val

    # Run wizard or use config directly
    if args.skip_prompts:
        if not existing_config:
            print(f"ERROR: No config file found at {config_path}")
            print("Run without --skip-prompts to use the interactive wizard.")
            sys.exit(1)
        cfg = existing_config
    elif existing_config and not args.skip_prompts:
        print(f"\nFound existing config at {config_path}")
        use_existing = input("  Use existing config? [Y/n]: ").strip().lower()
        if use_existing in ("", "y", "yes"):
            update = input("  Update settings? [y/N]: ").strip().lower()
            if update in ("y", "yes"):
                cfg = run_setup_wizard(existing_config)
            else:
                cfg = existing_config
        else:
            cfg = run_setup_wizard()
    else:
        cfg = run_setup_wizard(existing_config)

    # Set up logging
    verbose = args.verbose or cfg.get("options", {}).get("verbose", False)
    log = Logger(verbose=verbose)

    # Run deployment
    dry_run = args.dry_run or cfg.get("options", {}).get("dryRun", False)
    exit_code = run_deployment(cfg, log, dry_run=dry_run)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
