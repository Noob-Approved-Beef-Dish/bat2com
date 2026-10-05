# debug2com.ps1 - Convert a DOS DEBUG "e" script into a standalone .COM image
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File debug2com.ps1 input.bat [output.com]
#
# Design notes
#   * A .COM image always loads at CS:0100, so DEBUG address 0x100 == file offset 0.
#   * Only "e" (enter bytes) lines carry payload; w / q / a / u / n / r / g / t / p / d / m
#     and blank/comment lines are ignored on purpose.
#   * The image is refused when it cannot be a valid .COM:
#       - "e" address below 0x100   -> would map to a negative file offset
#       - "e" address above 0xFFFF  -> outside the 64 KB segment
#       - image larger than 65280 B -> 64 KB minus the 256 byte PSP
#   * Exit codes: 0 ok | 1 input missing | 2 bad address/byte | 3 image too big
#                 4 not a debug script (no e-lines) - caller may fall back
#   * File offsets never written stay 0x00 (that is what DEBUG does too).
#   * Keep this file pure ASCII: PowerShell 5.1 reads a BOM-less .ps1 as ANSI.

param(
    [Parameter(Mandatory=$true)][string]$InputFile,
    [string]$OutputFile
)

$ErrorActionPreference = 'Stop'
$BASE   = 0x100      # CS:0100
$MAXCOM = 65280      # 65536 - 256 (PSP)

if (-not (Test-Path -LiteralPath $InputFile)) {
    Write-Host "[ERROR] File not found: $InputFile" -ForegroundColor Red
    exit 1
}
if (-not $OutputFile) {
    $OutputFile = [System.IO.Path]::ChangeExtension($InputFile, '.com')
}

$lines   = @(Get-Content -LiteralPath $InputFile -Encoding ASCII)
$hexData = @{}      # fileOffset -> byte
$eLines  = 0
$ignored = 0
$lineNo  = 0

foreach ($line in $lines) {
    $lineNo++
    $t = $line.Trim()
    if ($t -eq '') { continue }

    if ($t -notmatch '^[eE]([\da-fA-F]+)(?:\s+([\s\S]*))?$') {
        # every non-empty line that is not an e-line counts as ignored,
        # so the report adds up: e-lines + ignored lines = non-empty lines
        $ignored++
        continue
    }

    $eLines++
    $addrHex = $Matches[1]
    $rest    = $Matches[2]
    $addr    = [int]::Parse($addrHex, 'HexNumber')

    if ($addr -lt $BASE) {
        Write-Host ("[ERROR] line {0}: address 0x{1} is below 0x100." -f $lineNo, $addrHex) -ForegroundColor Red
        Write-Host "        A .COM starts at CS:0100; this would write before the start of the file." -ForegroundColor Red
        exit 2
    }
    if ($addr -gt 0xFFFF) {
        Write-Host ("[ERROR] line {0}: address 0x{1} is outside the 64 KB segment (max 0xFFFF)." -f $lineNo, $addrHex) -ForegroundColor Red
        exit 2
    }

    if ([string]::IsNullOrWhiteSpace($rest)) { continue }   # bare "e100" = interactive edit, no payload

    $offset = $addr - $BASE
    # DEBUG also accepts bytes written without spaces (e.g. "e100 B409CD21"),
    # so every even-length hex token is split into 2-digit byte groups.
    foreach ($tok in ($rest -split '\s+' | Where-Object { $_ -ne '' })) {
        if ($tok -notmatch '^[\da-fA-F]+$' -or ($tok.Length % 2) -ne 0) {
            Write-Host ("[ERROR] line {0}: '{1}' is not an even-length hex byte group." -f $lineNo, $tok) -ForegroundColor Red
            exit 2
        }
        for ($i = 0; $i -lt $tok.Length; $i += 2) {
            if ($offset -gt 0xFFFF) {
                Write-Host ("[ERROR] line {0}: write runs past 0xFFFF." -f $lineNo) -ForegroundColor Red
                exit 2
            }
            $hexData[$offset] = [byte]::Parse($tok.Substring($i, 2), 'HexNumber')
            $offset++
        }
    }
}

if ($hexData.Count -eq 0) {
    if ($eLines -gt 0) {
        Write-Host "[ERROR] 'e' lines were found, but none carried hex data." -ForegroundColor Red
        exit 2
    }
    Write-Host "[INFO] no DEBUG e-lines found - this is not a debug script." -ForegroundColor Yellow
    exit 4
}

# Measure-Object -Maximum returns a double; {n:X4} only accepts integers.
$maxOffset  = [int](($hexData.Keys | Measure-Object -Maximum).Maximum)
$outputSize = $maxOffset + 1

if ($outputSize -gt $MAXCOM) {
    Write-Host ("[ERROR] image is {0} bytes; a .COM cannot exceed {1} bytes (64 KB minus the 256 byte PSP)." -f $outputSize, $MAXCOM) -ForegroundColor Red
    exit 3
}

$output = New-Object byte[] $outputSize
foreach ($o in $hexData.Keys) { $output[$o] = $hexData[$o] }

Write-Host ("e-lines: {0}    ignored lines: {1}" -f $eLines, $ignored) -ForegroundColor Cyan
Write-Host ("image  : 0x{0:X4} - 0x{1:X4}   {2} bytes   (limit {3})" -f $BASE, ($BASE + $maxOffset), $outputSize, $MAXCOM) -ForegroundColor Cyan
$gaps = $outputSize - $hexData.Count
if ($gaps -gt 0) { Write-Host ("gaps   : {0} byte(s) left as 0x00" -f $gaps) -ForegroundColor DarkGray }

[System.IO.File]::WriteAllBytes($OutputFile, $output)
Write-Host "Done -> $OutputFile" -ForegroundColor Green
Write-Host "Ready for DOSBox." -ForegroundColor Yellow
