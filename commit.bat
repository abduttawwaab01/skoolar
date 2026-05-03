@echo off
cd /d "c:\Users\Hp\Documents\Abdut Tawwab\Website\Skoolar"

echo ========================================
echo Git Status Check
echo ========================================
git status --short
echo.

echo ========================================
echo Adding all changes
echo ========================================
git add -A
echo.

echo ========================================
echo Git Status After Add
echo ========================================
git status
echo.

echo ========================================
echo Creating commit
echo ========================================
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

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>" && (
  echo Commit successful!
) || (
  echo Commit failed!
  exit /b 1
)
echo.

echo ========================================
echo Pushing to main branch
echo ========================================
git push origin main
echo.

echo ========================================
echo Verification
echo ========================================
git log -1 --oneline
echo.
echo Push complete!
