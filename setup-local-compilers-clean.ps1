# LabForCode - Local Compiler Setup Script
# Configures LabForCode to use your local compilers instead of Docker

Write-Host "LabForCode Local Compiler Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Please run this script from the LabForCode root directory." -ForegroundColor Red
    exit 1
}

Write-Host "`nDetecting available compilers..." -ForegroundColor Yellow

# Function to check if a command exists
function Test-Command($command) {
    try {
        & $command --version *>$null
        return $true
    } catch {
        return $false
    }
}

# Detect compilers
$compilers = @{
    "Python" = @{ available = (Test-Command "python") }
    "Node.js" = @{ available = (Test-Command "node") }
    "GCC (C)" = @{ available = (Test-Command "gcc") }
    "G++ (C++)" = @{ available = (Test-Command "g++") }
    "Go" = @{ available = (Test-Command "go") }
    "Rust" = @{ available = (Test-Command "rustc") }
    "Java" = @{ available = (Test-Command "javac") }
}

# Show detection results
foreach ($compiler in $compilers.GetEnumerator()) {
    if ($compiler.Value.available) {
        Write-Host "   Available: $($compiler.Key)" -ForegroundColor Green
    } else {
        Write-Host "   Not found: $($compiler.Key)" -ForegroundColor Red
    }
}

# Count available compilers
$availableCount = ($compilers.Values | Where-Object { $_.available }).Count
Write-Host "`nFound $availableCount out of 7 supported compilers." -ForegroundColor White

if ($availableCount -eq 0) {
    Write-Host "`nNo compilers found! Please install at least one compiler." -ForegroundColor Red
    exit 1
}

# Update .env.local
Write-Host "`nConfiguring .env.local for local compiler execution..." -ForegroundColor Yellow

if (Test-Path ".env.local") {
    # Update existing file
    $envContent = Get-Content ".env.local"
    $newEnvContent = @()

    foreach ($line in $envContent) {
        if ($line -match "^USE_DOCKER=") {
            $newEnvContent += "USE_DOCKER=false"
        } elseif ($line -match "^USE_LOCAL_COMPILERS=") {
            $newEnvContent += "USE_LOCAL_COMPILERS=true"
        } else {
            $newEnvContent += $line
        }
    }

    $newEnvContent | Set-Content ".env.local"
    Write-Host "   Updated .env.local for local compiler execution" -ForegroundColor Green
} else {
    Write-Host "   .env.local not found - please copy from .env.example first" -ForegroundColor Yellow
}

# Final summary
Write-Host "`nSETUP COMPLETE!" -ForegroundColor Green
Write-Host "===============" -ForegroundColor Green

Write-Host "`nLabForCode is now configured for local compiler execution!" -ForegroundColor Green
Write-Host "`nSupported languages on your system:" -ForegroundColor White
foreach ($compiler in $compilers.GetEnumerator()) {
    if ($compiler.Value.available) {
        Write-Host "  • $($compiler.Key)" -ForegroundColor Gray
    }
}

if (-not $compilers["Java"].available) {
    Write-Host "`nTo add Java support:" -ForegroundColor Yellow
    Write-Host "   Option 1: Install JDK from https://adoptium.net/" -ForegroundColor Gray
    Write-Host "   Option 2: Use Docker: docker-compose -f docker-java-only.yml up -d" -ForegroundColor Gray
}

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "   1. Start the development server: npm run dev" -ForegroundColor White
Write-Host "   2. Test local compilers: node test-local-compilers.js" -ForegroundColor White
Write-Host "   3. Test API functionality: bash test-api.sh" -ForegroundColor White
Write-Host "   4. Open http://localhost:3000 in your browser" -ForegroundColor White

Write-Host "`nLocal execution benefits:" -ForegroundColor Cyan
Write-Host "   • Faster execution (no Docker overhead)" -ForegroundColor Gray
Write-Host "   • Less storage usage (no Docker images)" -ForegroundColor Gray
Write-Host "   • Direct access to your system's compilers" -ForegroundColor Gray
