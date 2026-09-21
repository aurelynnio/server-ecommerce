param (
    [int]$Threads = 50,
    [int]$Duration = 30,
    [int]$RampUp = 5,
    [int]$SyncUsers = 25,
    [string]$HostTarget = "127.0.0.1",
    [int]$Port = 5000,
    [switch]$PrepareData,
    [string]$OpenReport = "true"
)

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $PSCommandPath
if (-not $ScriptDir) {
    $ScriptDir = (Get-Item -Path "tests\load").FullName
}
$ProjectRoot = (Get-Item -Path "$ScriptDir\..\..").FullName

$JMeterBin = "C:\Users\cyhin\Downloads\apache-jmeter-5.6.3\apache-jmeter-5.6.3\bin\jmeter.bat"
$JmxPath = "$ScriptDir\rabbitmq-order-concurrency.jmx"
$CsvPath = "$ScriptDir\test-users.csv"
$JtlPath = "$ScriptDir\results.jtl"
$ReportDir = "$ScriptDir\report"

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "JMETER LOAD TEST: FLASH SALE & RABBITMQ SHIELD" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "Threads (VUsers) : $Threads" -ForegroundColor Yellow
Write-Host "Ramp-up Time     : $RampUp s" -ForegroundColor Yellow
Write-Host "Test Duration    : $Duration s" -ForegroundColor Yellow
Write-Host "Flash Sale Burst : $SyncUsers users/batch" -ForegroundColor Yellow
Write-Host "Target API       : http://${HostTarget}:${Port}/api/orders/buy-now" -ForegroundColor Yellow
Write-Host "==========================================================="

if (-not (Test-Path $JMeterBin)) {
    Write-Error "Khong tim thay JMeter tai: $JMeterBin"
    exit 1
}

if ($PrepareData -or (-not (Test-Path $CsvPath))) {
    Write-Host "Dang chuan bi du lieu test..." -ForegroundColor Green
    node "$ScriptDir\prepare-test-data.js" --users $Threads
}

Write-Host "Khoi tao ton kho Fail-Fast tren Redis va MongoDB..." -ForegroundColor Green
node "$ScriptDir\seed-flashsale-stock.js"

Write-Host "Don dep file ket qua cu de tranh loi results.jtl is not empty..." -ForegroundColor Gray
if (Test-Path $JtlPath) {
    Remove-Item -Path $JtlPath -Force -ErrorAction SilentlyContinue
}
if (Test-Path $ReportDir) {
    Remove-Item -Path $ReportDir -Recurse -Force -ErrorAction SilentlyContinue
}

try {
    $resp = Invoke-RestMethod -Uri "http://${HostTarget}:${Port}/health/live" -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
    if ($resp) {
        Write-Host "Server backend dang hoat dong tot (/health/live)" -ForegroundColor Green
    }
} catch {
    Write-Host "Canh bao: Server backend tai http://${HostTarget}:${Port} chua phan hoi." -ForegroundColor Yellow
}

Write-Host "Kich hoat JMeter Non-GUI Runner..." -ForegroundColor Cyan
$jmeterArgs = @(
    "-n",
    "-t", $JmxPath,
    "-Jthreads=$Threads",
    "-Jrampup=$RampUp",
    "-Jduration=$Duration",
    "-Jsync_users=$SyncUsers",
    "-Jhost=$HostTarget",
    "-Jport=$Port",
    "-Jcsv_file=$CsvPath",
    "-l", $JtlPath,
    "-e",
    "-o", $ReportDir
)
& $JMeterBin @jmeterArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "===========================================================" -ForegroundColor Green
    Write-Host "KIEM THU TAI HOAN TAT THANH CONG!" -ForegroundColor Green
    Write-Host "===========================================================" -ForegroundColor Green
    Write-Host "File log raw     : $JtlPath" -ForegroundColor Yellow
    Write-Host "Bao cao HTML     : $ReportDir\index.html" -ForegroundColor Yellow

    if ($OpenReport -and (Test-Path "$ReportDir\index.html")) {
        Start-Process "$ReportDir\index.html"
    }
} else {
    Write-Host "JMeter ket thuc voi ma loi: $LASTEXITCODE" -ForegroundColor Red
}
