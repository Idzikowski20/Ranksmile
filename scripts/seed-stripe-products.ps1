# Seeds Ranksmile plans in Stripe via Stripe CLI.
# Prerequisite: stripe login  (or set STRIPE_SECRET_KEY and use scripts/seed-stripe-products.ts)
param(
  [string]$StripeExe = ''
)

$ErrorActionPreference = 'Stop'

if (-not $StripeExe) {
  $cmd = Get-Command stripe -ErrorAction SilentlyContinue
  if ($cmd) {
    $StripeExe = $cmd.Source
  } else {
    $wingetStripe = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "stripe.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($wingetStripe) { $StripeExe = $wingetStripe.FullName }
  }
}

if (-not $StripeExe -or -not (Test-Path $StripeExe)) {
  throw 'Stripe CLI not found. Install: winget install Stripe.StripeCli — then restart terminal.'
}

$configPath = Join-Path $env:USERPROFILE '.config\stripe\config.toml'
if (-not (Test-Path $configPath)) {
  Write-Host ''
  Write-Host 'Stripe CLI nie jest zalogowany.' -ForegroundColor Yellow
  Write-Host 'Uruchom w terminalu: stripe login' -ForegroundColor Cyan
  Write-Host 'Potwierdz kod w przegladarce, potem: npm run stripe:seed:cli' -ForegroundColor Cyan
  Write-Host ''
  exit 2
}

function Get-StripeConfigValue {
  param([string]$Key)
  $content = Get-Content $configPath -Raw
  if ($content -match "(?m)^$Key\s*=\s*'([^']*)'") { return $Matches[1] }
  if ($content -match "(?m)^$Key\s*=\s*`"([^`"]*)`"") { return $Matches[1] }
  return $null
}

function New-RanksmilePlan {
  param(
    [string]$Slug,
    [string]$Name,
    [int]$MonthlyCents,
    [int]$YearlyCents
  )

  Write-Host "Creating $Name..." -ForegroundColor Green
  $productJson = (& $StripeExe products create `
    --name "Ranksmile $Name" `
    -d "metadata[plan_slug]=$Slug" `
    -d "metadata[app]=ranksmile") -join "`n"
  $product = $productJson | ConvertFrom-Json

  $monthlyJson = (& $StripeExe prices create `
    --product $product.id `
    --currency eur `
    --unit-amount $MonthlyCents `
    -d "recurring[interval]=month" `
    -d "metadata[plan_slug]=$Slug" `
    -d "metadata[billing_period]=monthly") -join "`n"
  $monthly = $monthlyJson | ConvertFrom-Json

  $yearlyJson = (& $StripeExe prices create `
    --product $product.id `
    --currency eur `
    --unit-amount $YearlyCents `
    -d "recurring[interval]=year" `
    -d "metadata[plan_slug]=$Slug" `
    -d "metadata[billing_period]=yearly") -join "`n"
  $yearly = $yearlyJson | ConvertFrom-Json

  return [ordered]@{
    Slug = $Slug
    ProductId = $product.id
    MonthlyId = $monthly.id
    YearlyId = $yearly.id
  }
}

$plans = @(
  @{ Slug = 'starter'; Name = 'Starter'; Monthly = 2900; Yearly = 28800 },
  @{ Slug = 'growth'; Name = 'Growth'; Monthly = 5900; Yearly = 58800 },
  @{ Slug = 'scale'; Name = 'Scale'; Monthly = 11900; Yearly = 118800 },
  @{ Slug = 'agency'; Name = 'Agency'; Monthly = 24900; Yearly = 248400 }
)

$created = @()
foreach ($plan in $plans) {
  $created += New-RanksmilePlan -Slug $plan.Slug -Name $plan.Name -MonthlyCents $plan.Monthly -YearlyCents $plan.Yearly
}

$testKey = Get-StripeConfigValue 'test_mode_api_key'
$pubKey = Get-StripeConfigValue 'test_mode_pub_key'

$envBlock = @(
  '',
  '# === Stripe (auto-seeded) ===',
  "STRIPE_SECRET_KEY=$testKey",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$pubKey",
  'STRIPE_WEBHOOK_SECRET='
)

foreach ($row in $created) {
  $upper = $row.Slug.ToUpper()
  $envBlock += "STRIPE_PRICE_${upper}_MONTHLY=$($row.MonthlyId)"
  $envBlock += "STRIPE_PRICE_${upper}_YEARLY=$($row.YearlyId)"
}

Write-Host ''
Write-Host '=== Created products ===' -ForegroundColor Green
$created | Format-Table -AutoSize

Write-Host '=== Add to .env ===' -ForegroundColor Cyan
$envBlock | ForEach-Object { Write-Host $_ }

$envPath = Join-Path (Get-Location) '.env'
$append = $envBlock -join "`n"
if (Test-Path $envPath) {
  $existing = Get-Content $envPath -Raw
  if ($existing -notmatch 'STRIPE_SECRET_KEY=') {
    Add-Content -Path $envPath -Value $append
    Write-Host "Dodano zmienne Stripe do $envPath" -ForegroundColor Green
  } else {
    $lines = Get-Content $envPath
    $out = foreach ($line in $lines) {
      $updated = $line
      foreach ($row in $created) {
        $upper = $row.Slug.ToUpper()
        if ($line -match "^STRIPE_PRICE_${upper}_MONTHLY=") { $updated = "STRIPE_PRICE_${upper}_MONTHLY=$($row.MonthlyId)" }
        if ($line -match "^STRIPE_PRICE_${upper}_YEARLY=") { $updated = "STRIPE_PRICE_${upper}_YEARLY=$($row.YearlyId)" }
      }
      $updated
    }
    Set-Content -Path $envPath -Value $out -Encoding utf8
    Write-Host "Zaktualizowano price ID w $envPath" -ForegroundColor Green
  }
}

Write-Host ''
Write-Host 'Webhook lokalnie: stripe listen --forward-to localhost:3000/api/webhooks/stripe' -ForegroundColor Cyan
