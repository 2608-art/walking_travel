"""Maintain one GitHub review issue per audit scope; never change app data."""

import base64
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen


REGION_NAMES = {"mokpo": "목포", "gangneung": "강릉", "gyeongju": "경주"}
SCOPE_NAMES = {"weekly": "주간", "monthly": "월간"}
MARKER = "<!-- hours-audit-state:"


def api(method, path, payload=None):
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GITHUB_TOKEN"]
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request("https://api.github.com/repos/" + repo + path, data=body, method=method,
                      headers={"Authorization": "Bearer " + token, "Accept": "application/vnd.github+json",
                               "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "HangeoreumHoursAudit/1.0",
                               "Content-Type": "application/json"})
    with urlopen(request, timeout=20) as response:
        return json.load(response)


def fingerprint(row):
    relevant = {key: row[key] for key in ("source", "status", "evidence")}
    return hashlib.sha256(json.dumps(relevant, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def stored_state(body):
    marker = body.rfind(MARKER)
    if marker < 0:
        return {}, body
    encoded = body[marker + len(MARKER):].split(" -->", 1)[0]
    try:
        return json.loads(base64.b64decode(encoded)), body[:marker].rstrip()
    except (ValueError, json.JSONDecodeError):
        return {}, body[:marker].rstrip()


def format_row(row):
    status = {"ok": "출처 문구 확인", "no_source": "조회 출처 없음", "not_fetchable": "자동 조회 제한",
              "fetch_error": "조회 실패", "no_hours_visible": "시간 문구 추출 실패"}[row["status"]]
    source = "[출처](" + row["source"] + ")" if row["source"] else "출처 없음"
    lines = ["- **" + row["name"] + "** (`" + row["id"] + "`, " + row["sourceType"] + ") — " + status + "; " + source,
             "  - 위치: " + row["location"][:130],
             "  - 앱 기록: " + row["appHours"][:180] + " / " + row["appClosure"][:180]]
    if row["evidence"]:
        lines.append("  - 현재 페이지: " + " | ".join(s[:180] for s in row["evidence"][:2]))
    return "\n".join(lines)


def main(report_path):
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    title = "[운영시간 점검] " + REGION_NAMES[report["region"]] + " " + SCOPE_NAMES[report["scope"]] + " 검토 목록"
    issue = None
    for page in range(1, 11):
        issues = api("GET", "/issues?state=all&per_page=100&page=" + str(page))
        issue = next((item for item in issues if item.get("title") == title and "pull_request" not in item), None)
        if issue or len(issues) < 100:
            break
    prior, visible = stored_state(issue.get("body") or "") if issue else ({}, "")
    current = {row["id"]: fingerprint(row) for row in report["rows"]}
    changed = [row for row in report["rows"] if prior.get(row["id"]) != current[row["id"]]]
    if issue and not changed:
        print("No source changes; issue unchanged:", issue["html_url"])
        return
    place_file = {"mokpo": "public/places.json", "gangneung": "public/gangneung-places.json",
                  "gyeongju": "public/gyeongju-places.json"}[report["region"]]
    header = ("이 이슈는 공개 출처의 운영시간 관련 문구를 자동 수집한 **검토 목록**입니다. "
              "페이지 문구는 실제 영업의 확정 근거가 아니며 앱 데이터는 자동 수정하지 않습니다. "
              "공식 페이지가 있으면 우선합니다. "
              + ("이 지역은 현재 앱에서 공개 전입니다. " if not report["regionReady"] else "") + "\n\n"
              "검토할 때 장소의 현행 운영시간·정기휴무·날짜별 예외·마지막 입장/주문을 확인하고, "
              "확인한 내용만 `" + place_file + "`에 반영해 배포하세요. 새로 생성하는 추천 루트는 배포된 데이터를 사용합니다.\n")
    no_source = [row for row in changed if row["status"] == "no_source"]
    details = [row for row in changed if row["status"] != "no_source"]
    detail_text = "\n".join(format_row(row) for row in details)
    if len(detail_text) > 39000:
        detail_text = detail_text[:39000].rsplit("\n- **", 1)[0] + "\n\n나머지 상세 결과는 이 실행의 JSON 보고서를 확인하세요."
    run_url = ("https://github.com/" + os.environ["GITHUB_REPOSITORY"] + "/actions/runs/"
               + os.environ.get("GITHUB_RUN_ID", ""))
    section = ("\n## " + report["checkedAt"] + " UTC · " + report["scope"] + "\n\n"
               + f"점검 대상 {report['placesCount']}곳, 새 검토 항목 {len(changed)}곳. "
               + "처음 실행한 경우 현재 출처를 초기 기준으로 기록합니다. "
               + "[전체 JSON 보고서](" + run_url + ")\n\n"
               + detail_text + "\n\n"
               + ("**자동 조회 출처 없음 " + str(len(no_source)) + "곳:** " + ", ".join(
                   row["name"] + " (`" + row["id"] + "`)" for row in no_source) + "\n" if no_source else ""))
    if issue:
        visible += section
    else:
        visible = header + section
    # Keep the recent review history readable within GitHub's issue body limit.
    if len(visible) > 49000:
        visible = header + "\n이전 내역은 이슈의 편집 이력에서 확인할 수 있습니다.\n" + section
    state = {**prior, **current}
    encoded = base64.b64encode(json.dumps(state, separators=(",", ":")).encode()).decode()
    body = visible.rstrip() + "\n\n" + MARKER + encoded + " -->"
    result = api("PATCH" if issue else "POST", "/issues/" + str(issue["number"]) if issue else "/issues",
                 {"body": body, "state": "open"} if issue else {"title": title, "body": body})
    print("Review issue:", result["html_url"], "changed:", len(changed))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: publish-hours-audit.py REPORT.json")
    main(sys.argv[1])
