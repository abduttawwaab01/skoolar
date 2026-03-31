# Skoolar Deployment Guide
## Cloudflare Workers + Neon + R2 Storage

---

## 📋 Tech Stack Overview

| Component | Technology | Status |
|-----------|------------|--------|
| **Frontend/Backend** | Next.js 16.1.1 | ✅ Ready |
| **Database** | Neon (PostgreSQL) | ⚠️ Needs Setup |
| **Storage** | Cloudflare R2 | ⚠️ Needs Setup |
| **Auth** | NextAuth.js (JWT) | ✅ Ready |
| **Deployment** | Cloudflare Workers | ⚠️ Needs Setup |

---

## 🔍 Database Comparison: Neon vs Supabase

| Feature | **Neon** ✅ | Supabase ❌ |
|---------|-------------|-------------|
| **Free Tier** | 100 CU-hours/month | Limited |
| **Storage** | 0.5 GB | 500 MB |
| **Egress** | 5 GB/month | 5 GB/month |
| **API Limits** | **No limits** - compute-based | Row-level limits |
| **Scale to Zero** | After 5 min idle | No |
| **Branching** | 10 free branches | 1 branch |
| **Projects** | 100 free | 2 free |

**Verdict: Neon is better for free forever** - no API call limits, scales to zero when idle.

---

## 🚀 Phase 1: Neon Database Setup

### Step 1.1: Create Neon Account
1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub
3. Create a new project:
   - Name: `skoolar-db`
   - Region: `EU (Frankfurt)` or closest to your users

### Step 1.2: Get Connection String
1. In Neon dashboard, go to **Connection Details**
2. Select **Pooled connection** (recommended for serverless)
3. Copy the connection string:
   ```
   postgresql://username:password@ep-xxx.eu-central-1.aws.neon.tech/skoolar?sslmode=require
   ```

### Step 1.3: Update .env with Database URL
```env
# .env
DATABASE_URL=postgresql://username:password@ep-xxx.eu-central-1.aws.neon.tech/skoolar?sslmode=require
```

### Step 1.4: Push Schema to Neon
```bash
npm install
npx prisma db push
```

---

## 🪣 Phase 2: Cloudflare R2 Storage Setup

### Step 2.1: Login to Cloudflare
```bash
wrangler login
```

### Step 2.2: Create R2 Bucket
```bash
wrangler r2 bucket create skoolar
```

### Step 2.3: Enable Public Access (Important!)
1. Go to Cloudflare Dashboard → R2 → **Manage API Tokens**
2. Create token with **Edit** permissions
3. Go to bucket settings → **Settings** → Enable **Public Access**
4. Add your domain: `storage.skoolar.org`

### Step 2.4: Configure Custom Domain (Optional)
1. Go to R2 bucket → **Settings** → **Custom Domains**
2. Add: `storage.skoolar.org`
3. Create CNAME in DNS:
   ```
   Type: CNAME
   Name: storage
   Target: skoolar.r2.cloudflarestorage.com
   ```

---

## 🔧 Phase 3: Environment Configuration

### Step 3.1: Create Production .env file
Create `.env.production`:

```env
# ============================================
# REQUIRED - Database (Neon)
# ============================================
DATABASE_URL=postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/skoolar?sslmode=require

# ============================================
# REQUIRED - Authentication
# Generate at: https://generate-secret.vercel.app/32
# ============================================
NEXTAUTH_SECRET=your-32-character-random-string-here
NEXTAUTH_URL=https://skoolar.org

# ============================================
# REQUIRED - Payments (Paystack)
# Get from: https://dashboard.paystack.com/#/settings/developer
# ============================================
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# OPTIONAL - R2 Storage
# ============================================
R2_BUCKET_NAME=skoolar
R2_PUBLIC_URL=https://storage.skoolar.org

# ============================================
# OPTIONAL - Email (Resend recommended)
# ============================================
EMAIL_SERVER_HOST=smtp.resend.com
EMAIL_SERVER_PORT=587
EMAIL_FROM=noreply@skoolar.org
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Step 3.2: Generate NEXTAUTH_SECRET
```bash
# Run this to generate a secure secret
openssl rand -base64 32
```

---

## 🌐 Phase 4: Cloudflare Workers Deployment

### Step 4.1: Update wrangler.toml
Update `wrangler.toml`:

```toml
:name = "skoolar"
main = ".open-next/worker.js"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "skoolar"

[vars]
NEXTAUTH_URL = "https://skoolar.org"
R2_PUBLIC_URL = "https://storage.skoolar.org"
R2_BUCKET_NAME = "skoolar"

[site]
bucket = ".open-next/assets"
```

### Step 4.2: Build the Application
```bash
npm run cf:build
```

### Step 4.3: Deploy to Cloudflare
```bash
# Deploy to production
npm run cf:deploy

# Or deploy with custom domain
npx wrangler deploy --env production
```

---

## 🔗 Phase 5: DNS & Domain Configuration

### Step 5.1: Add Domain to Cloudflare
1. Go to Cloudflare Dashboard → **Websites**
2. Add `skoolar.org`
3. Update nameservers at your registrar

### Step 5.2: Configure CNAME for R2 (if using custom subdomain)
```
Type: CNAME
Name: storage.skoolar.org
Target: skoolar.r2.cloudflarestorage.com
```

### Step 5.3: Workers Routes
Create a page rule or custom domain for the worker:
- Go to Workers → skoolar → **Triggers**
- Add custom domain: `skoolar.org`

---

## ✅ Phase 6: Post-Deployment Verification

### Step 6.1: Test Authentication
1. Visit https://skoolar.org
2. Try to login with test credentials

### Step 6.2: Test Database Connection
Check Cloudflare Workers logs for any database errors

### Step 6.3: Test File Upload
1. Go to admin panel
2. Try uploading an image
3. Verify it appears in R2

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         skoolar.org                             │
│                     (Cloudflare Workers)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   Next.js    │────▶│   Prisma     │────▶│    Neon      │    │
│  │   App        │     │   (HTTP)     │     │  PostgreSQL   │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                    │                                    │
│         ▼                    ▼                                    │
│  ┌──────────────┐     ┌──────────────┐                          │
│  │  NextAuth    │     │     R2       │                          │
│  │  (JWT)       │     │  Storage     │                          │
│  └──────────────┘     └──────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌─────────┐    ┌──────────┐    ┌──────────┐
         │ Paystack│    │  Email   │    │  Socket  │
         │ Payment │    │ (Resend) │    │  .io    │
         └─────────┘    └──────────┘    └──────────┘
```

---

## 💰 Cost Estimation (Monthly)

| Service | Free Tier | Estimated Cost |
|---------|-----------|----------------|
| **Neon** | 100 CU-hours + 0.5 GB | **$0** |
| **R2** | 10 GB + 10M requests | **$0** |
| **Cloudflare Workers** | 100K requests/day | **$0** |
| **DNS** | Unlimited | **$0** |
| **Domain** | .org ~$12/year | **$1/month** |

**Total: ~$1/month** (just domain cost)

---

## 🔧 Troubleshooting

### Issue: "NEXTAUTH_SECRET is not set"
**Solution:** Set the environment variable in Cloudflare Dashboard → Workers → skoolar → Settings → Variables

### Issue: Database connection timeout
**Solution:** 
- Use pooled connection (not direct)
- Check DATABASE_URL format
- Ensure Neon compute is active (not suspended)

### Issue: R2 file not loading
**Solution:**
- Verify R2 bucket has public access enabled
- Check R2_PUBLIC_URL is set correctly
- Verify CNAME DNS record

---

## 📝 Quick Deploy Commands

```bash
# 1. Install dependencies
npm install

# 2. Push database schema
npx prisma db push

# 3. Build for Cloudflare
npm run cf:build

# 4. Deploy
npm run cf:deploy
```

---

## 📞 Need Help?

If you encounter issues, check:
1. Cloudflare Workers logs (Dashboard → Workers → skoolar → Logs)
2. Neon's **Monitor** tab for query performance
3. Browser console for frontend errors