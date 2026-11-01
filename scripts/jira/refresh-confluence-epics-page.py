#!/usr/bin/env python3
"""Refresh the Confluence "FHS: Epics & Tickets" page from live Jira state.

Runs after every ticket close (CLAUDE.md "Closing tickets (post-merge)" rule).
Pulls every FHS epic + its children and renders a PM-friendly "delivery
tracker": a top progress summary, then phases in real delivery order (Foundation
-> Auth -> Parent App -> Kid World -> Signup -> Modules -> Billing -> Invites ->
Launch). Each phase shows a done/total progress bar + its epics; each epic
expands to its stories so done-vs-left is visible at every level. PUTs version+1
to page id 3079340034.

The phase grouping is CURATED here (EPIC_PHASE), not read from the Jira Fix
Version field: those tags drifted (e.g. the kid 5-tab epic was tagged
white-label). When a new epic is created, add it to EPIC_PHASE; until then it
shows under "Unscoped" at the bottom as a reminder.

Usage:
    python3 scripts/jira/refresh-confluence-epics-page.py
    python3 scripts/jira/refresh-confluence-epics-page.py --reason "FHS-158 close"

Reads env vars: EMAIL, JIRA_API_TOKEN, URL. Standard library only.
"""

# `dict | None` in an annotation is a syntax error before 3.10, and macOS still
# ships 3.9 as its system python3. Deferring annotation evaluation keeps the
# modern spelling working on a stock Mac with nothing installed.
from __future__ import annotations

import argparse
import base64
import html
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

PAGE_ID = "3079340034"
CONFLUENCE_API = "https://qualicion2.atlassian.net/wiki/api/v2"

# Delivery phases, in the order work actually ships. Each phase has a short id
# + a human title. Epics map to a phase via EPIC_PHASE below.
PHASES: list[tuple[str, str]] = [
    ("foundation", "Foundation & Infrastructure"),
    ("auth", "Auth & Access Control"),
    ("parent", "Parent App"),
    ("kid", "Kid World"),
    ("design", "Design & UX"),
    ("beta", "Beta & Feedback"),
    ("signup", "Signup & Custom URL"),
    ("modules", "Modules & Gating"),
    ("billing", "Billing"),
    ("invites", "Invites & Roles"),
    ("launch", "White-Label Launch"),
    ("crosscut", "Cross-cutting & Ops"),
    ("commercial", "Commercial"),
]

# Every FHS epic -> its delivery phase. Curated (see module docstring).
EPIC_PHASE: dict[str, str] = {
    # Foundation & Infrastructure
    "FHS-1": "foundation", "FHS-7": "foundation", "FHS-12": "foundation",
    "FHS-18": "foundation", "FHS-143": "foundation", "FHS-149": "foundation",
    "FHS-155": "foundation", "FHS-160": "foundation", "FHS-165": "foundation",
    "FHS-171": "foundation", "FHS-177": "foundation", "FHS-588": "foundation",
    # Auth & Access Control
    "FHS-178": "auth", "FHS-179": "auth", "FHS-333": "auth", "FHS-344": "auth",
    # Parent App
    "FHS-220": "parent", "FHS-226": "parent", "FHS-240": "parent",
    "FHS-260": "parent", "FHS-272": "parent",
    # Kid World
    "FHS-234": "kid", "FHS-239": "kid", "FHS-282": "kid", "FHS-290": "kid",
    "FHS-368": "kid", "FHS-388": "kid", "FHS-393": "kid",
    # Signup & Custom URL
    "FHS-23": "signup", "FHS-29": "signup", "FHS-35": "signup", "FHS-42": "signup",
    # Modules & Gating
    "FHS-47": "modules", "FHS-53": "modules", "FHS-58": "modules", "FHS-64": "modules",
    # Billing
    "FHS-68": "billing", "FHS-73": "billing", "FHS-78": "billing", "FHS-84": "billing",
    # Invites & Roles
    "FHS-90": "invites", "FHS-97": "invites", "FHS-104": "invites", "FHS-110": "invites",
    # White-Label Launch
    "FHS-116": "launch", "FHS-123": "launch", "FHS-129": "launch", "FHS-136": "launch",
    # Design & UX
    "FHS-423": "design", "FHS-496": "design", "FHS-576": "design",
    "FHS-580": "design",
    # Beta & Feedback
    "FHS-417": "beta", "FHS-434": "beta", "FHS-470": "beta",
    # Cross-cutting & Ops
    "FHS-205": "crosscut", "FHS-254": "crosscut", "FHS-459": "crosscut",
    # Commercial
    "FHS-590": "commercial",
}

# A resolved status counts as "delivered" for progress (CLAUDE.md treats
# Won't Do / Cancelled as Done).
DONE_STATUSES = {"Done", "Cancelled", "Won't Do"}
STATUS_COLOURS = {
    "Done": "Green",
    "In Progress": "Blue",
    "To Do": "Medium-Gray",
    "Cancelled": "Gray",
    "Won't Do": "Gray",
}
# Sort order within a phase / within an epic: in-progress first (needs eyes),
# then to-do, then done (settled).
STATUS_SORT = {"In Progress": 0, "To Do": 1, "Done": 2, "Cancelled": 3, "Won't Do": 3}


def env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        sys.exit(f"error: env var {name} is required (source .env.local first)")
    return v


def auth_headers() -> dict:
    token = base64.b64encode(f"{env('EMAIL')}:{env('JIRA_API_TOKEN')}".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "family-hub-web/refresh-confluence-epics-page",
    }


class HttpError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def http(method: str, url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=auth_headers())
    try:
        with urllib.request.urlopen(req) as r:
            text = r.read().decode()
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        raise HttpError(e.code, f"HTTP {e.code} on {method} {url}\n{e.read().decode()}") from e


def jql(query: str, fields: str = "summary,status") -> list[dict]:
    base = env("URL").rstrip("/")
    issues: list[dict] = []
    next_token: str | None = None
    while True:
        params = {"jql": query, "fields": fields, "maxResults": 100}
        if next_token:
            params["nextPageToken"] = next_token
        url = f"{base}/rest/api/3/search/jql?" + urllib.parse.urlencode(params)
        page = http("GET", url)
        issues.extend(page.get("issues", []))
        next_token = page.get("nextPageToken")
        if not next_token or page.get("isLast"):
            break
    return issues


def esc(s: str | None) -> str:
    return html.escape(s or "", quote=True)


def jira_macro(key: str) -> str:
    return (
        '<ac:structured-macro ac:name="jira" ac:schema-version="1">'
        f'<ac:parameter ac:name="key">{esc(key)}</ac:parameter>'
        "</ac:structured-macro>"
    )


def status_lozenge(name: str) -> str:
    colour = STATUS_COLOURS.get(name, "Medium-Gray")
    return (
        '<ac:structured-macro ac:name="status">'
        f'<ac:parameter ac:name="title">{esc(name)}</ac:parameter>'
        f'<ac:parameter ac:name="colour">{colour}</ac:parameter>'
        "</ac:structured-macro>"
    )


def is_done(issue: dict) -> bool:
    return issue["fields"]["status"]["name"] in DONE_STATUSES


def bar(done: int, total: int) -> str:
    """A 10-segment unicode progress bar + percentage, e.g. ▓▓▓▓▓░░░░░ 50%."""
    pct = round(done / total * 100) if total else 0
    filled = round(pct / 10)
    return f"{'▓' * filled}{'░' * (10 - filled)} {pct}%"


def story_expand(children: list[dict]) -> str:
    """A collapsed expander listing an epic's stories with status lozenges."""
    done = sum(1 for c in children if is_done(c))
    total = len(children)
    if total == 0:
        return "0/0"
    rows = []
    for c in sorted(children, key=lambda c: (STATUS_SORT.get(c["fields"]["status"]["name"], 9), c["key"])):
        rows.append(
            f"<li>{status_lozenge(c['fields']['status']['name'])} "
            f"{jira_macro(c['key'])} {esc(c['fields']['summary'])}</li>"
        )
    return (
        '<ac:structured-macro ac:name="expand">'
        f'<ac:parameter ac:name="title">{done}/{total} stories</ac:parameter>'
        f"<ac:rich-text-body><ul>{''.join(rows)}</ul></ac:rich-text-body>"
        "</ac:structured-macro>"
    )


def render_body(epics: list[dict], epic_children: dict[str, list[dict]]) -> str:
    # Bucket epics into phases (Rank order preserved from the fetch).
    by_phase: dict[str, list[dict]] = {pid: [] for pid, _ in PHASES}
    by_phase["_unscoped"] = []
    for e in epics:
        by_phase.setdefault(EPIC_PHASE.get(e["key"], "_unscoped"), []).append(e)

    def counts(epic_list: list[dict]) -> tuple[int, int, int, int]:
        ed = sum(1 for e in epic_list if is_done(e))
        et = len(epic_list)
        sd = sum(1 for e in epic_list for c in epic_children[e["key"]] if is_done(c))
        st = sum(len(epic_children[e["key"]]) for e in epic_list)
        return ed, et, sd, st

    tot_ed, tot_et, tot_sd, tot_st = counts(epics)

    parts: list[str] = [
        "<p>Auto-generated from Jira by "
        "<code>scripts/jira/refresh-confluence-epics-page.py</code> after every ticket "
        "close. Epics are grouped by <strong>delivery phase</strong> (the order work "
        "ships), each expandable to its stories so you can see what is done and what "
        "is left.</p>",
        '<ac:structured-macro ac:name="info"><ac:rich-text-body>'
        "<p><strong>Where we are</strong></p>"
        f"<p><strong>Epics:</strong> {bar(tot_ed, tot_et)} &nbsp;({tot_ed}/{tot_et} done)</p>"
        f"<p><strong>Stories:</strong> {bar(tot_sd, tot_st)} &nbsp;({tot_sd}/{tot_st} done)</p>"
        "</ac:rich-text-body></ac:structured-macro>",
    ]

    colgroup = (
        "<colgroup>"
        '<col style="width: 110.0px;" />'
        '<col style="width: 380.0px;" />'
        '<col style="width: 220.0px;" />'
        "</colgroup>"
    )

    display_phases = list(PHASES)
    if by_phase["_unscoped"]:
        display_phases = display_phases + [("_unscoped", "Unscoped (add to EPIC_PHASE)")]

    for idx, (pid, title) in enumerate(display_phases, start=1):
        epic_list = by_phase.get(pid, [])
        if not epic_list:
            continue
        # Done epics settle to the bottom of the phase; active work rises.
        epic_list = sorted(
            epic_list, key=lambda e: (STATUS_SORT.get(e["fields"]["status"]["name"], 9), e["key"])
        )
        ed, et, sd, st = counts(epic_list)
        parts.append(f"<h2>{idx}. {esc(title)}</h2>")
        parts.append(
            f"<p>{bar(sd, st)} &nbsp;, <strong>{ed}/{et} epics</strong> done "
            f"&middot; {sd}/{st} stories</p>"
        )
        parts.append("<table>" + colgroup + "<tbody>")
        parts.append("<tr><th>Status</th><th>Epic</th><th>Stories</th></tr>")
        for e in epic_list:
            children = epic_children[e["key"]]
            parts.append(
                "<tr>"
                f"<td>{status_lozenge(e['fields']['status']['name'])}</td>"
                f"<td>{jira_macro(e['key'])} {esc(e['fields']['summary'])}</td>"
                f"<td>{story_expand(children)}</td>"
                "</tr>"
            )
        parts.append("</tbody></table>")

    return "\n".join(parts)


def get_page() -> dict:
    return http("GET", f"{CONFLUENCE_API}/pages/{PAGE_ID}?body-format=storage")


def put_page(version: int, title: str, body: str, message: str) -> dict:
    return http(
        "PUT",
        f"{CONFLUENCE_API}/pages/{PAGE_ID}",
        body={
            "id": PAGE_ID,
            "status": "current",
            "title": title,
            "body": {"representation": "storage", "value": body},
            "version": {"number": version, "message": message},
        },
    )


def put_with_retry(title: str, body: str, reason: str) -> dict:
    """PUT the page, retrying once on 409 Conflict (someone edited the page
    in-browser between our fetch and PUT)."""
    for attempt in (1, 2):
        page = get_page()
        new_version = page["version"]["number"] + 1
        try:
            return put_page(new_version, title, body, f"{reason} (v{new_version})")
        except HttpError as e:
            if e.status == 409 and attempt == 1:
                print("  page was edited externally: refetching and retrying...")
                continue
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--reason", default="Auto-refresh", help="Version-history message.")
    args = parser.parse_args()

    print("Fetching epics...")
    epics = jql("project = FHS AND issuetype = Epic ORDER BY Rank ASC", fields="summary,status")
    print(f"  {len(epics)} epics")
    if not epics:
        sys.exit("error: Jira returned 0 epics: refusing to overwrite the page with an empty body")

    print("Fetching children per epic...")
    epic_children: dict[str, list[dict]] = {}
    for e in epics:
        epic_children[e["key"]] = jql(f'parent = {e["key"]} ORDER BY Rank ASC', fields="summary,status")

    body = render_body(epics, epic_children)
    title = get_page()["title"]
    print(f"Updating page {PAGE_ID} ({title!r})...")
    try:
        result = put_with_retry(title, body, args.reason)
    except HttpError as e:
        sys.exit(str(e))
    print(f"OK: refreshed to v{result['version']['number']}: {args.reason}")


if __name__ == "__main__":
    main()
