# Git Commit and Push Script for Skoolar Production Release
# Run this script in PowerShell from the repository root directory

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Skoolar Production Release - Git Operations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set the working directory
$repoPath = "c:\Users\Hp\Documents\Abdut Tawwab\Website\Skoolar"
Set-Location $repoPath

# Step 1: Check git status
Write-Host "Step 1: Checking Git Status" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
git --no-pager status --short
Write-Host ""

# Step 2: Stage all changes
Write-Host "Step 2: Staging All Changes" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
git add -A
Write-Host "✓ All changes staged" -ForegroundColor Green
Write-Host ""

# Step 3: Show what will be committed
Write-Host "Step 3: Changes Ready to Commit" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
git --no-pager status --short
Write-Host ""

# Step 4: Create the commit
Write-Host "Step 4: Creating Commit" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray

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

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Commit created successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Commit failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Push to remote
Write-Host "Step 5: Pushing to Origin Main" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Push completed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Push failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Verify the push
Write-Host "Step 6: Verification" -ForegroundColor Yellow
Write-Host "---" -ForegroundColor Gray
Write-Host "Latest commit:" -ForegroundColor Cyan
git --no-pager log -1 --oneline
Write-Host ""
Write-Host "Remote tracking:" -ForegroundColor Cyan
git --no-pager log -1 --oneline origin/main
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "✓ Release Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
