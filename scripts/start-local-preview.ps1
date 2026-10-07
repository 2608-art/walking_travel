$previewRoot = Split-Path -Parent $PSScriptRoot
if (Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue) {
    Write-Output '8765 포트에서 미리보기 서버가 이미 실행 중입니다.'
    exit 0
}
# 기존 공개 사이트의 같은 경로 API를 사용한다. 키를 브라우저나 파일에 복사하지 않는다.
if (-not $env:HANGEORUM_ROUTE_PROXY) {
    $env:HANGEORUM_ROUTE_PROXY = 'https://mokpo-day-planner.sooyeon-jun-0389.chatgpt.site'
}
Start-Process -FilePath (Get-Command python).Source -ArgumentList '-u', 'server.py' -WorkingDirectory $previewRoot -WindowStyle Hidden
Write-Output '경로 중계가 연결된 로컬 미리보기를 실행했습니다: http://localhost:8765/'
