# Wrapper — winget installs stripe.exe but PATH may need a new terminal.
$wingetStripe = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "stripe.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $wingetStripe) { throw 'Stripe CLI not found. Run: winget install Stripe.StripeCli' }
& $wingetStripe.FullName @args
