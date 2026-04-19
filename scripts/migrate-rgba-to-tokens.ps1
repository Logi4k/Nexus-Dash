# Migrates hardcoded rgba(r,g,b,a) / rgba(r,g,b) values in TSX files to
# rgba(var(--token-rgb), a) form. Non-destructive — only replaces known RGB
# triplets that map to existing CSS tokens. Unknown triplets are left alone.
#
# Run from repo root:  pwsh scripts/migrate-rgba-to-tokens.ps1
#
# Known mappings (RGB triplet -> CSS var name):
$map = @{
  "34,197,94"    = "--color-profit-rgb"
  "239,68,68"    = "--color-loss-rgb"
  "245,158,11"   = "--color-warn-rgb"
  "196,160,107"  = "--accent-rgb"
  "127,153,172"  = "--color-blue-rgb"
  "185,137,102"  = "--color-orange-rgb"
  "118,153,141"  = "--color-teal-rgb"
  "14,184,154"   = "--color-teal-rgb"
  "143,136,170"  = "--color-purple-rgb"
  "155,142,194"  = "--color-purple-rgb"
  "167,139,250"  = "--color-purple-rgb"
  "59,130,246"   = "--color-blue-rgb"
  "91,139,191"   = "--color-blue-rgb"
  "122,128,180"  = "--color-indigo-rgb"
  "212,168,74"   = "--color-orange-rgb"
  "106,175,170"  = "--color-teal-rgb"
  "149,101,106"  = "--color-loss-rgb"
  "148,163,184"  = "--border-rgb"
  "100,116,139"  = "--border-rgb"
  "161,161,170"  = "--border-rgb"
  "124,135,152"  = "--border-rgb"
}

$targets = Get-ChildItem -Recurse -Include *.tsx -Path src/pages, src/components |
           Where-Object { $_.FullName -notmatch '__tests__' }

$totalReplacements = 0
foreach ($file in $targets) {
  $content = Get-Content -Raw -LiteralPath $file.FullName
  $original = $content
  foreach ($key in $map.Keys) {
    $var = $map[$key]
    # Allow flexible whitespace in the triplet: "r , g , b"
    $parts = $key -split ','
    $pattern = "rgba\(\s*$($parts[0])\s*,\s*$($parts[1])\s*,\s*$($parts[2])\s*,\s*([\d.]+)\s*\)"
    $content = [regex]::Replace($content, $pattern, { param($m) "rgba(var($var), $($m.Groups[1].Value))" })
    $patternNoAlpha = "rgb\(\s*$($parts[0])\s*,\s*$($parts[1])\s*,\s*$($parts[2])\s*\)"
    $content = [regex]::Replace($content, $patternNoAlpha, "rgb(var($var))")
  }
  if ($content -ne $original) {
    $diffCount = ($original.Length - $content.Length) + 1
    Set-Content -LiteralPath $file.FullName -Value $content -NoNewline
    Write-Host "migrated  $($file.FullName)"
    $totalReplacements++
  }
}
Write-Host ""
Write-Host "Files modified: $totalReplacements"
