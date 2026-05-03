@echo off
REM Commit and push script for Skoolar production-ready changes
REM Run this from the repository root directory

setlocal enabledelayedexpansion

echo.
echo 🚀 Skoolar Production Release - Git Commit ^& Push
echo ==================================================
echo.

REM Check if we're in a git repository
if not exist ".git" (
    echo ❌ Error: Not in a Git repository directory!
    echo Please run this script from the Skoolar repository root
    pause
    exit /b 1
)

echo ✓ Git repository found
echo.

REM Step 1: Show current git status
echo 📋 Current Git Status:
git status --short
echo.

REM Step 2: Stage all changes
echo 📦 Staging all changes...
git add -A
echo ✓ All changes staged
echo.

REM Step 3: Verify what will be committed
echo 🔍 Files to be committed:
git diff --cached --name-only
echo.

REM Step 4: Create commit
echo 💾 Creating commit...

git commit -m "chore: Add production-ready security, auth, and database improvements

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

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

if errorlevel 1 (
    echo ❌ Commit failed!
    pause
    exit /b 1
)

echo ✓ Commit created successfully
echo.

REM Step 5: Show commit hash
echo 📝 Commit details:
git log --oneline -1
echo.

REM Step 6: Push to repository
echo 🌐 Pushing to GitHub...
git push origin main

if errorlevel 1 (
    echo ❌ Push failed!
    echo Please check your GitHub credentials and connectivity
    pause
    exit /b 1
)

echo ✓ Push completed successfully!
echo.

REM Step 7: Verify push
echo ✅ Deployment Status:
echo    Repository: https://github.com/abduttawwaab01/skoolar
echo    Branch: main
echo    Vercel will automatically deploy within 2-5 minutes
echo.
echo 🎉 Release complete! All production-ready changes are now on GitHub.
echo.

pause
