# Commit and push script for Skoolar production-ready changes
# Run this from the repository root directory

Write-Host "🚀 Skoolar Production Release - Git Commit & Push" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Verify we're in the right directory
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not in a Git repository directory!" -ForegroundColor Red
    Write-Host "Please run this script from the Skoolar repository root" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Git repository found" -ForegroundColor Green
Write-Host ""

# Step 1: Show current git status
Write-Host "📋 Current Git Status:" -ForegroundColor Yellow
git status --short
Write-Host ""

# Step 2: Stage all changes
Write-Host "📦 Staging all changes..." -ForegroundColor Yellow
git add -A
Write-Host "✓ All changes staged" -ForegroundColor Green
Write-Host ""

# Step 3: Verify what will be committed
Write-Host "🔍 Files to be committed:" -ForegroundColor Yellow
git diff --cached --name-only
Write-Host ""

# Step 4: Create commit
Write-Host "💾 Creating commit..." -ForegroundColor Yellow

$commitMessage = @"
chore: Add production-ready security, auth, and database improvements

Security & Middleware:
- Add CSRF protection middleware (csrf-middleware.ts)
- Add standardized API error handler (api-error-handler.ts)
- Add type-safe JSON parsing utilities (json-parsers.ts)
- Add authentication to PUT/DELETE routes for students, teachers, exams

Environment & Configuration:
- Update env-validation with JWT validation and R2 config
- Add NEXT_PUBLIC_APP_URL environment variable
- Extended .env with comprehensive configuration
- Update .env.example with all required variables (SUPER_ADMIN_EMAIL, R2, OpenRouter, Upstash)

Database Schema:
- Major Prisma schema refactoring with M2M relationships
- Add proper indexes for performance
- Configure CASCADE deletes for data integrity
- Support soft deletes with deletedAt timestamps

Git & Build:
- Fix .gitignore to properly exclude node_modules, .next, build artifacts, logs

All changes are production-ready and tested for Vercel deployment.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
"@

git commit -m $commitMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Commit failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Commit created successfully" -ForegroundColor Green
Write-Host ""

# Step 5: Show commit hash
Write-Host "📝 Commit details:" -ForegroundColor Yellow
git log --oneline -1
Write-Host ""

# Step 6: Push to repository
Write-Host "🌐 Pushing to GitHub..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host "Please check your GitHub credentials and connectivity" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Push completed successfully!" -ForegroundColor Green
Write-Host ""

# Step 7: Verify push
Write-Host "✅ Deployment Status:" -ForegroundColor Green
Write-Host "   Repository: https://github.com/abduttawwaab01/skoolar" -ForegroundColor Cyan
Write-Host "   Branch: main" -ForegroundColor Cyan
Write-Host "   Vercel will automatically deploy within 2-5 minutes" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Release complete! All production-ready changes are now on GitHub." -ForegroundColor Green
