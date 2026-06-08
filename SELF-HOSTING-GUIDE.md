# Skoolar — Self-Hosting Guide (Oracle Cloud Free Tier)

**Zero-cost infrastructure for production use.** This guide walks you through setting up and managing Skoolar on Oracle Cloud Free Tier with Cloudflare CDN/R2 — everything you need to run a production-grade school management platform for free, forever.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & Accounts](#2-prerequisites--accounts)
3. [Oracle Cloud VM Provisioning](#3-oracle-cloud-vm-provisioning)
4. [Initial Server Setup](#4-initial-server-setup)
5. [Tailscale VPN Setup](#5-tailscale-vpn-setup)
6. [Cloudflare Setup (DNS + Tunnel + R2)](#6-cloudflare-setup)
7. [Database Installation & Migration](#7-database-installation--migration)
8. [Deploying Skoolar with Docker](#8-deploying-skoolar-with-docker)
9. [Email Server Setup (Postfix)](#9-email-server-setup-postfix)
10. [LiveKit & Real-Time Services](#10-livekit--real-time-services)
11. [Local LLM Setup (Optional)](#11-local-llm-setup-optional)
12. [Monitoring & Alerts](#12-monitoring--alerts)
13. [Backup Strategy](#13-backup-strategy)
14. [Security Hardening](#14-security-hardening)
15. [Daily/Weekly Management Tasks](#15-dailyweekly-management-tasks)
16. [Troubleshooting](#16-troubleshooting)
17. [Appendix: Useful Commands](#17-appendix-useful-commands)

---

## 1. Architecture Overview

```
Internet
    │
    ├── Cloudflare CDN (caches static assets from R2)
    │       │
    │       ├── Cloudflare Tunnel → Oracle Cloud VM
    │       │       │
    │       │       ├── Traefik / Caddy (reverse proxy)
    │       │       │       ├── app.skoolar.org   → Next.js (port 3000)
    │       │       │       ├── socketio.skoolar.org → Socket.IO (port 3003)
    │       │       │       ├── livekit.skoolar.org → LiveKit (port 7880)
    │       │       │       └── llm.skoolar.org   → LLM API (port 8080)
    │       │       │
    │       │       ├── PostgreSQL (port 5432, localhost only)
    │       │       ├── Postfix (port 587, SMTP)
    │       │       └── Prometheus + Node Exporter (monitoring)
    │       │
    │       └── Cloudflare R2 (file storage — images, PDFs, etc.)
    │
    └── Tailscale (admin SSH — no public SSH port)
```

**Key decisions:**
- **No public SSH** — all admin access via Tailscale VPN
- **Cloudflare Tunnel** — services behind Cloudflare; no public IP exposure
- **Docker Compose** — all services containerized for easy management
- **200 GB block storage** — mounted at `/data` for PostgreSQL, backups, etc.

---

## 2. Prerequisites & Accounts

### What you need before starting:

| Account | Why | Cost |
|---------|-----|------|
| [Oracle Cloud](https://cloud.oracle.com) | Free Tier VM (4 ARM + 2 AMD cores, 24 GB RAM, 200 GB storage) | Free forever |
| [Cloudflare](https://dash.cloudflare.com) | DNS, CDN, R2 storage, Tunnel (Argo) | Free forever |
| [Tailscale](https://tailscale.com) | VPN for admin SSH access | Free for personal use |
| [Paystack](https://dashboard.paystack.com) | Payment processing (keep your existing) | 1% + ₦100 per tx |
| [Namecheap/Cloudflare Registrar](https://cloudflare.com) | Domain (you already own skoolar.org) | ~$10/year |

### Domain DNS setup (already done, just verify):
```
skoolar.org          → Cloudflare CDN (proxied)
www.skoolar.org      → Cloudflare CDN (proxied)
cdn.skoolar.org      → Cloudflare R2 (CNAME to r2.cloudflarestorage.com)
livekit.skoolar.org  → Cloudflare Tunnel (proxied, A/AAAA to tunnel)
llm.skoolar.org      → Cloudflare Tunnel (proxied, A/AAAA to tunnel)
socketio.skoolar.org → Cloudflare Tunnel (proxied, A/AAAA to tunnel)
admin.skoolar.org    → Tailscale IP (no proxy — for SSH)
```

---

## 3. Oracle Cloud VM Provisioning

### Step 3.1: Sign in to Oracle Cloud

1. Go to https://cloud.oracle.com
2. Sign in with your Oracle Cloud account
3. If you don't have one, create a free account (requires credit card for verification, but you won't be charged)

### Step 3.2: Create a VM instance

1. **Navigate:** Menu → Compute → Instances → Create Instance
2. **Name:** `skoolar-vm`
3. **Placement:** Keep defaults (or choose your nearest region)
4. **Image:** **Canonical Ubuntu 24.04 LTS** (or 22.04 LTS) — ARM64 architecture
5. **Shape:**
   - Click "Change shape"
   - Select **Arm** → **VM.Standard.A1.Flex**
   - Select **4 OCPUs** and **24 GB RAM** (this is the full free tier allowance)
   - *Note: 4 OCPUs + 24 GB RAM is always free on ARM. You also get 2 AMD micro instances for free.*
6. **Networking:**
   - Select your compartment
   - Virtual cloud network: **Create new VCN** (or select existing)
   - Subnet: **Create new public subnet**
   - **IMPORTANT:** Do NOT assign a public IPv4 address (we use Cloudflare Tunnel + Tailscale instead)
     - If you must have one for initial setup, select "Assign a public IPv4 address" — you can remove it later
7. **Boot volume:**
   - **200 GB** (the free tier maximum)
   - Leave encryption defaults
8. **Add SSH keys:**
   - Upload your public SSH key OR generate a new key pair
   - *This is for emergency access only. We'll use Tailscale day-to-day.*
9. Click **Create**

### Step 3.3: Attach block storage (optional, for PostgreSQL data)

The boot volume is 200 GB which is enough for everything. But if you want separation:

1. Menu → Storage → Block Volumes → Create Block Volume
2. Name: `skoolar-data`, Size: **200 GB**
3. Attach to your VM as a paravirtualized device
4. SSH into the VM and format it:
   ```bash
   sudo lsblk  # Find the new device (e.g., /dev/sdb)
   sudo mkfs.ext4 /dev/sdb
   sudo mkdir -p /data
   sudo mount /dev/sdb /data
   echo '/dev/sdb /data ext4 defaults 0 0' | sudo tee -a /etc/fstab
   ```

### Step 3.4: Configure firewall (security lists)

In Oracle Cloud, firewalls are managed via **Security Lists** (not iptables on the VM):

1. Go to Menu → Networking → Virtual Cloud Networks → your VCN
2. Click on your subnet's **Security List**
3. **Remove** the default ingress rule for port 22 (SSH) from `0.0.0.0/0`
4. Add ingress rules for your Tailscale IP range only (you'll get this after setting up Tailscale):
   - Source CIDR: `100.64.0.0/10` (Tailscale range)
   - Protocol: TCP, Destination Port Range: `22` (SSH)
5. If you must assign a public IP temporarily, add:
   - Source CIDR: `0.0.0.0/0`
   - Protocol: TCP, Destination Port Range: `80, 443`
   - *Remove these once Cloudflare Tunnel is working.*

---

## 4. Initial Server Setup

SSH into your VM (from your local machine):

```bash
# If you gave the VM a public IP:
ssh ubuntu@<public-ip>

# If using Tailscale (after setup below):
ssh ubuntu@skoolar-vm
```

### Step 4.1: System updates & essentials

```bash
# Update everything
sudo apt update && sudo apt upgrade -y

# Install essentials
sudo apt install -y \
  curl wget git vim htop net-tools \
  ufw fail2ban unattended-upgrades \
  apt-transport-https ca-certificates software-properties-common

# Set timezone
sudo timedatectl set-timezone Africa/Lagos

# Verify
hostnamectl
free -h
df -h
```

### Step 4.2: Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

# Log out and back in for group changes to take effect
exit
# Then SSH back in

# Verify
docker --version
docker compose version
```

### Step 4.3: Create project directory & clone the repo

```bash
sudo mkdir -p /opt/skoolar
sudo chown ubuntu:ubuntu /opt/skoolar
cd /opt/skoolar

# Clone your repository
git clone https://github.com/your-org/skoolar.git .
# OR: upload the code from your local machine via SCP/Tailscale

# Create persistent data directories
mkdir -p data/postgres data/backups data/caddy data/letsencrypt
```

### Step 4.4: Configure environment

```bash
cd /opt/skoolar
cp .env.example .env
nano .env
```

Fill in your actual values. The key variables for self-hosting:

```ini
# Database (local PostgreSQL)
DATABASE_PROVIDER=pg
DATABASE_URL=postgresql://skoolar:YOUR_STRONG_PASSWORD@postgres:5432/skoolardb?sslmode=disable
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD

# Cloudflare R2 (from Cloudflare Dashboard)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=skoolar
NEXT_PUBLIC_CDN_URL=https://cdn.skoolar.org

# LiveKit
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.skoolar.org

# Email (Postfix)
EMAIL_PROVIDER=smtp
EMAIL_SERVER_HOST=localhost
EMAIL_SERVER_PORT=587
EMAIL_FROM=noreply@skoolar.org
```

### Step 4.5: Install and configure UFW

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Only allow Tailscale interface SSH (Tailscale traffic comes through tailscale0)
sudo ufw allow in on tailscale0 to any port 22

# Allow Docker bridge traffic
sudo ufw allow in on docker0

# Enable
sudo ufw --force enable
sudo ufw status
```

### Step 4.6: Enable automatic security updates

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
# Select "Yes" when prompted

# Verify
sudo systemctl status unattended-upgrades
```

---

## 5. Tailscale VPN Setup

Tailscale gives you secure, zero-config SSH access to your VM without opening any public ports.

### Step 5.1: Install Tailscale on the VM

```bash
curl -fsSL https://tailscale.com/install.sh | sudo sh
sudo tailscale up --ssh --advertise-tags=tag:server

# Follow the URL it prints to authenticate in your browser
# After authentication, verify:
tailscale status
tailscale ip -4  # This is your Tailscale IP (100.x.x.x)
```

### Step 5.2: Install Tailscale on your local machine

- **Windows:** Download from https://tailscale.com/download
- **macOS:** `brew install --cask tailscale`
- **Linux:** `curl -fsSL https://tailscale.com/install.sh | sh`

### Step 5.3: Configure Tailscale SSH

Run this on your local machine:

```bash
# Add the VM to your tailnet
tailscale up

# SSH using the machine name (no IP needed!)
ssh ubuntu@skoolar-vm

# Or using the Tailscale IP
ssh ubuntu@100.x.x.x
```

### Step 5.4: Restrict SSH to Tailscale only

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Add/modify:
# ListenAddress 100.x.x.x  (your VM's Tailscale IP)
# ListenAddress 127.0.0.1
# PasswordAuthentication no
# PermitRootLogin no
# AllowUsers ubuntu

# Restart SSH
sudo systemctl restart sshd

# NOW TEST in a NEW terminal before closing this one!
# From your local machine:
ssh ubuntu@skoolar-vm
```

### Step 5.5: Set up Tailscale Funnel (optional, for admin dashboard)

If you want to expose an admin dashboard via Tailscale:

```bash
tailscale funnel 8080
```

---

## 6. Cloudflare Setup

### Step 6.1: Configure DNS

In your Cloudflare Dashboard → **DNS** → **Records**, add:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `www` | `skoolar.org` | Proxied (orange cloud) |
| CNAME | `cdn` | `your-bucket.r2.cloudflarestorage.com` | Proxied |
| CNAME | `livekit` | `your-tunnel-id.cfargotunnel.com` | Proxied |
| CNAME | `llm` | `your-tunnel-id.cfargotunnel.com` | Proxied |
| CNAME | `socketio` | `your-tunnel-id.cfargotunnel.com` | Proxied |
| A | `@` | `192.0.2.1` (placeholder — tunnel handles this) | Proxied |
| AAAA | `@` | `100::1` (placeholder) | Proxied |

> **Note:** The A/AAAA records for the root domain are placeholders. Cloudflare Tunnel handles the actual routing. The DNS just needs the orange cloud (proxied) to work.

### Step 6.2: Create R2 Bucket

1. Cloudflare Dashboard → **R2** → **Create Bucket**
2. Name: `skoolar`
3. Location: **Automatic**
4. **Public access:** Enable public access at `cdn.skoolar.org`
   - Go to **Settings** → **Public Access**
   - Add a CNAME record: `cdn.skoolar.org`
   - Even if CNAME isn't fully propagated, direct R2.dev URL works

5. **Create R2 API tokens:**
   - Go to **R2** → **Overview** → **Manage R2 API Tokens**
   - Create token with **Read+Write+Delete** permissions on the `skoolar` bucket
   - Save the `Access Key ID` and `Secret Access Key` — you'll need them for `.env`

### Step 6.3: Install & Configure Cloudflare Tunnel

**On your Oracle VM:**

```bash
# Install cloudflared
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared

# Authenticate
cloudflared tunnel login
# Follow the URL to authenticate with your Cloudflare account

# Create a tunnel
cloudflared tunnel create skoolar

# This creates a credentials JSON file. Note the tunnel ID shown.
```

**Create the tunnel configuration file:**

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

```yaml
tunnel: YOUR-TUNNEL-ID
credentials-file: /home/ubuntu/.cloudflared/YOUR-TUNNEL-ID.json

ingress:
  # Main Next.js app
  - hostname: www.skoolar.org
    service: http://localhost:3000
  - hostname: skoolar.org
    service: http://localhost:3000

  # Socket.IO (real-time)
  - hostname: socketio.skoolar.org
    service: http://localhost:3003

  # LiveKit API
  - hostname: livekit.skoolar.org
    service: http://localhost:7880

  # LiveKit WebRTC (UDP media) — requires additional config
  - hostname: livekit-turn.skoolar.org
    service: http://localhost:3478

  # LLM API (optional)
  - hostname: llm.skoolar.org
    service: http://localhost:8080

  # Catch-all: 404
  - service: http_status:404
```

**Run the tunnel as a system service:**

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

**Update DNS records to point to the tunnel:**

```bash
# Create DNS records pointing to the tunnel
cloudflared tunnel route dns skoolar skoolar.org
cloudflared tunnel route dns skoolar www.skoolar.org
cloudflared tunnel route dns skoolar livekit.skoolar.org
cloudflared tunnel route dns skoolar llm.skoolar.org
cloudflared tunnel route dns skoolar socketio.skoolar.org
```

### Step 6.4: LiveKit UDP through Cloudflare Tunnel

LiveKit requires UDP for WebRTC media. Cloudflare Tunnel supports QUIC/HTTP2 transport:

1. In your `cloudflared config.yml`, add the LiveKit UDP port:

```yaml
# Add this ingress rule BEFORE the catch-all
- hostname: livekit.skoolar.org
  service: http://localhost:7880
  # For UDP/QUIC support, Cloudflare Tunnel currently forwards via HTTP2
  # The LiveKit client will use the TURN server for UDP fallback
```

2. Configure LiveKit's `livekit.yaml` to use the TURN server:

```yaml
turn:
  enabled: true
  domain: livekit.skoolar.org
  cert_file: ""
  key_file: ""
  tls_port: 5349
  udp_port: 3478
  external_turn:
    - host: livekit-turn.skoolar.org
      port: 3478
      protocol: udp
```

3. In your `docker-compose.yml`, ensure the Coturn container exposes the right ports.

---

## 7. Database Installation & Migration

### Step 7.1: Start PostgreSQL

The database runs as a Docker container defined in `docker-compose.yml`.

```bash
cd /opt/skoolar

# Start only PostgreSQL
docker compose up -d postgres

# Verify it's running
docker compose ps postgres
docker compose logs postgres

# Test connection
docker compose exec postgres psql -U skoolar -d skoolardb -c "SELECT version();"
```

### Step 7.2: Run Prisma migrations

```bash
# Install Prisma CLI (if not already)
cd /opt/skoolar
npm install

# Push the schema to the database
DATABASE_URL="postgresql://skoolar:YOUR_PASSWORD@localhost:5432/skoolardb" \
  npx prisma db push

# Or generate the migration file
DATABASE_URL="postgresql://skoolar:YOUR_PASSWORD@localhost:5432/skoolardb" \
  npx prisma migrate dev --name init
```

### Step 7.3: Migrate data from Neon (production migration)

**When you're ready to switch from Neon to your self-hosted PostgreSQL:**

**Step A — Take a backup from Neon:**

Run from your **local machine** (or any machine with `psql`):

```bash
pg_dump \
  --dbname="postgresql://neondb_owner:password@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  -f neon-backup.dump

# The .dump file should be a few MB (not GB)
```

**Step B — Copy the dump to the Oracle VM:**

```bash
# Using Tailscale
scp neon-backup.dump ubuntu@skoolar-vm:/tmp/

# OR using rsync
rsync -avz --progress neon-backup.dump ubuntu@skoolar-vm:/tmp/
```

**Step C — Restore on the Oracle VM:**

```bash
cd /opt/skoolar

# Copy the dump into the postgres container
docker compose cp /tmp/neon-backup.dump postgres:/tmp/

# Restore
docker compose exec postgres pg_restore \
  --dbname=postgresql://skoolar:YOUR_PASSWORD@localhost:5432/skoolardb \
  --no-owner \
  --no-acl \
  --verbose \
  /tmp/neon-backup.dump
```

**Step D — Verify the data:**

```bash
docker compose exec postgres psql -U skoolar -d skoolardb -c "
  SELECT COUNT(*) as users FROM \"User\";
  SELECT COUNT(*) as schools FROM \"School\";
"
```

**Step E — Update DATABASE_URL in .env:**

```bash
nano /opt/skoolar/.env
# Change DATABASE_URL to point to your self-hosted PostgreSQL
```

**Step F — Rollback plan (if something goes wrong):**

```bash
# Just change DATABASE_URL back to Neon in .env
# And restart the app
docker compose restart app
```

### Step 7.4: Database maintenance

```bash
# Vacuum (weekly)
docker compose exec postgres psql -U skoolar -d skoolardb -c "VACUUM ANALYZE;"

# Check database size
docker compose exec postgres psql -U skoolar -d skoolardb -c "
  SELECT pg_database_size('skoolardb') / 1024 / 1024 AS size_mb;
"

# List active connections
docker compose exec postgres psql -U skoolar -d skoolardb -c "
  SELECT pid, usename, application_name, client_addr, state
  FROM pg_stat_activity
  WHERE datname = 'skoolardb';
"
```

---

## 8. Deploying Skoolar with Docker

### Step 8.1: Build and start all services

```bash
cd /opt/skoolar

# Build the Next.js app image
NEXT_DEPLOY_TARGET=docker docker compose build app

# Build the Socket.IO image
docker compose build socketio

# Start everything
docker compose up -d

# Check status
docker compose ps
docker compose logs -f --tail=50
```

### Step 8.2: Verify services are running

```bash
# Check each service
curl -s http://localhost:3000/api/health | head -20
curl -s http://localhost:3003/health
curl -s http://localhost:7880/rtc/health

# Test from outside via Cloudflare Tunnel
curl -s https://www.skoolar.org/api/health
```

### Step 8.3: Useful Docker commands

```bash
# View logs for a specific service
docker compose logs -f app
docker compose logs -f postgres

# Restart a single service
docker compose restart app

# Rebuild and restart
docker compose up -d --build app

# Stop everything
docker compose down

# Stop and remove volumes (DESTROYS DATA!)
docker compose down -v

# Execute a command in a running container
docker compose exec app npx prisma db push
docker compose exec postgres psql -U skoolar -d skoolardb

# Check resource usage
docker stats
```

### Step 8.4: Zero-downtime deployment

For production updates with minimal downtime:

```bash
#!/bin/bash
# deploy.sh - Zero-downtime deployment script

cd /opt/skoolar

echo "Pulling latest code..."
git pull

echo "Building new app image..."
docker compose build app

echo "Starting new container (old one keeps running)..."
docker compose up -d --no-deps --scale app=2 app

echo "Waiting for health check..."
sleep 10

# Check if new container is healthy
if curl -s http://localhost:3000/api/health | grep -q "Operational"; then
    echo "New container healthy. Removing old container..."
    # Stop old container
    docker compose stop app-old 2>/dev/null || true
    echo "Deployment successful!"
else
    echo "Health check failed. Rolling back..."
    docker compose up -d --no-deps --scale app=1 app
    echo "Rolled back to previous version."
fi
```

---

## 9. Email Server Setup (Postfix)

### Step 9.1: Install Postfix on the VM

```bash
# Install Postfix
sudo apt install -y postfix postfix-pcre mailutils

# During installation, select "Internet Site"
# Set system mail name: skoolar.org
```

### Step 9.2: Configure Postfix

```bash
sudo nano /etc/postfix/main.cf
```

Make these changes:

```cf
# Basic config
myhostname = skoolar.org
mydomain = skoolar.org
myorigin = $mydomain
inet_interfaces = 127.0.0.1, 100.x.x.x  # Add your Tailscale IP
inet_protocols = ipv4

# Relay via an SMTP provider (recommended for deliverability)
# Free options: SendGrid (100/day), Mailgun (free tier), or keep Resend
relayhost = [smtp.resend.com]:587
smtp_sasl_auth_enable = yes
smtp_sasl_password_maps = hash:/etc/postfix/sasl_passwd
smtp_sasl_security_options = noanonymous
smtp_tls_security_level = encrypt
smtp_tls_CAfile = /etc/ssl/certs/ca-certificates.crt

# Rate limiting
smtp_destination_rate_delay = 1s
default_destination_concurrency_limit = 5

# Message size limit (for attachments)
message_size_limit = 26214400  # 25MB

# Logging
maillog_file = /var/log/mail.log
```

**Set up SMTP credentials for relay:**

```bash
# Edit SASL passwords file
sudo nano /etc/postfix/sasl_passwd
```

Add:

```
[smtp.resend.com]:587 re_XXXXX:your-resend-api-key
```

Then:

```bash
sudo chmod 600 /etc/postfix/sasl_passwd
sudo postmap /etc/postfix/sasl_passwd
sudo systemctl restart postfix
```

### Step 9.3: Test email delivery

```bash
# Send a test email
echo "Test email from Skoolar's self-hosted Postfix" | \
  mail -s "Test Email" -r "noreply@skoolar.org" your-email@gmail.com

# Check logs
sudo tail -f /var/log/mail.log

# Check queue
mailq

# Flush queue (if stuck)
sudo postfix flush
```

### Step 9.4: Update Skoolar's .env for Postfix

```ini
EMAIL_PROVIDER=smtp
EMAIL_SERVER_HOST=localhost
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
EMAIL_FROM=noreply@skoolar.org
```

### Step 9.5: Monitor deliverability

```bash
# Check bounce logs
sudo cat /var/log/mail.log | grep "bounced"

# Check deferred mail
sudo postqueue -p | head -20

# Weekly DMARC/DKIM reports
# Set up SPF, DKIM, and DMARC DNS records:
# TXT record @: v=spf1 include:_spf.resend.com ~all
```

---

## 10. LiveKit & Real-Time Services

### Step 10.1: Deploy LiveKit

LiveKit is already configured in `docker-compose.yml`:

```bash
cd /opt/skoolar
docker compose up -d livekit coturn

# Verify
curl -s http://localhost:7880/rtc/health
# Should return: {"ready":true}
```

### Step 10.2: Configure LiveKit for production

Edit `livekit.yaml`:

```yaml
port: 7880
bind_addresses:
  - "0.0.0.0"
rtc:
  port: 7882
  use_external_ip: false  # Don't expose external IP
  force_relay: relay      # Force TURN relay for all clients
  stun_servers:
    - "stun:stun.l.google.com:19302"
  tcp_port: 7881
keys:
  your-livekit-key: your-livekit-secret
logging:
  level: info
turn:
  enabled: true
  domain: livekit.skoolar.org
  tls_port: 5349
  udp_port: 3478
  external_turn:
    - host: localhost
      port: 3478
      protocol: udp
```

### Step 10.3: Deploy Socket.IO

The Socket.IO server is already included in `docker-compose.yml`:

```bash
docker compose up -d socketio

# Verify
curl -s http://localhost:3003/health
```

The client (Next.js frontend) connects to Socket.IO via the Cloudflare Tunnel using the path `/?XTransformPort=3003` which Caddy routes to port 3003.

### Step 10.4: LiveKit Token Generation

The existing code in `src/lib/livekit.ts` already handles token generation. Just make sure your `.env` has:

```ini
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
LIVEKIT_URL=ws://livekit:7880  # Internal Docker network URL
NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.skoolar.org  # Public WebSocket URL
```

---

## 11. Local LLM Setup (Optional)

### Step 11.1: Start Ollama

Uncomment the `llm` service in `docker-compose.yml`:

```yaml
llm:
  image: ollama/ollama:latest
  restart: unless-stopped
  volumes:
    - ollama_data:/root/.ollama
  ports:
    - "127.0.0.1:8080:11434"
  deploy:
    resources:
      limits:
        memory: 4G
```

Then start it and pull a model:

```bash
docker compose up -d llm

# Pull a model (this takes a few minutes)
docker compose exec llm ollama pull mistral:7b
# Or smaller/faster models:
# docker compose exec llm ollama pull phi:2.7b
# docker compose exec llm ollama pull qwen:4b

# Test the API
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"mistral:7b","messages":[{"role":"user","content":"Hello!"}]}'
```

### Step 11.2: Update Skoolar's .env for local LLM

```ini
AI_PROVIDER=local
LOCAL_LLM_BASE_URL=http://llm:11434/v1
LOCAL_LLM_MODEL=mistral:7b
LOCAL_LLM_API_KEY=
```

### Step 11.3: Set up OpenRouter fallback

The AI chat route already falls back between models. When `AI_PROVIDER=local`, it tries the local LLM first. If you want OpenRouter as a fallback for when the local LLM fails, set both:

```ini
AI_PROVIDER=local
OPENROUTER_API_KEY=sk-or-v1-your-key  # Fallback
```

The code will try the local LLM first, and if it fails, attempt OpenRouter models.

### Step 11.4: Model comparison

| Model | RAM needed | Speed | Quality | Best for |
|-------|-----------|-------|---------|----------|
| `phi:2.7b` | ~2 GB | Fast | Low | Quick answers, chat |
| `qwen:4b` | ~3 GB | Fast | Medium | General use |
| `mistral:7b` | ~4 GB | Medium | Good | Education, tutoring |
| `llama3:8b` | ~6 GB | Slow | Very Good | Complex reasoning |

> **Note:** On Oracle ARM with 4 OCPUs and 24 GB RAM, `mistral:7b` runs at ~10-15 tokens/second which is acceptable for chat. For better performance, consider using OpenRouter's free models instead.

---

## 12. Monitoring & Alerts

### Step 12.1: Set up Uptime Kuma

Uptime Kuma is a self-hosted uptime monitor. Run it alongside Skoolar:

```bash
docker run -d \
  --name uptime-kuma \
  --restart unless-stopped \
  -p 127.0.0.1:3001:3001 \
  -v /opt/skoolar/data/uptime-kuma:/app/data \
  louislam/uptime-kuma:latest
```

Access it via Tailscale at `http://skoolar-vm:3001` or set up a Tunnel rule.

**Monitors to add:**
- `https://www.skoolar.org/api/health` — HTTP (every 60s)
- `https://livekit.skoolar.org/rtc/health` — HTTP (every 60s)  
- `https://socketio.skoolar.org/health` — HTTP (every 60s)
- Ping to `100.x.x.x` (VM's Tailscale IP) — Ping (every 60s)

**Notification:** Set up Uptime Kuma to notify you via email, Telegram, or Slack.

### Step 12.2: Server resource monitoring

```bash
# Install Prometheus Node Exporter
docker run -d \
  --name node-exporter \
  --restart unless-stopped \
  --network host \
  --pid host \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /:/rootfs:ro \
  prom/node-exporter:latest \
  --path.procfs=/host/proc \
  --path.sysfs=/host/sys \
  --path.rootfs=/rootfs

# Access at: http://localhost:9100/metrics
```

### Step 12.3: Basic health check

Create a simple monitoring script:

```bash
#!/bin/bash
# /opt/skoolar/scripts/health-check.sh

services=(
  "postgres:5432"
  "app:3000"
  "socketio:3003"
  "livekit:7880"
)

for service in "${services[@]}"; do
  name="${service%%:*}"
  port="${service##*:}"

  if nc -z localhost "$port" 2>/dev/null; then
    echo "✅ $name is running on port $port"
  else
    echo "❌ $name is DOWN on port $port"
  fi
done

# Check Disk Usage
disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 85 ]; then
  echo "⚠️  WARNING: Disk usage at ${disk_usage}%"
else
  echo "✅ Disk usage: ${disk_usage}%"
fi

# Check Memory
free_mem=$(free -m | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ "$free_mem" -gt 90 ]; then
  echo "⚠️  WARNING: Memory usage at ${free_mem}%"
else
  echo "✅ Memory usage: ${free_mem}%"
fi
```

Run it via cron every 10 minutes:

```bash
crontab -e
# Add:
*/10 * * * * /opt/skoolar/scripts/health-check.sh >> /var/log/skoolar-health.log 2>&1
```

### Step 12.4: Docker container health

```bash
# Check all container statuses
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Get a quick summary
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

---

## 13. Backup Strategy

### Step 13.1: Database backups (automatic daily)

Create a backup script:

```bash
#!/bin/bash
# /opt/skoolar/scripts/backup.sh
set -e

BACKUP_DIR="/opt/skoolar/data/backups"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
DB_NAME="skoolardb"
DB_USER="skoolar"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Dump the database
docker compose exec -T postgres pg_dump \
  -U "$DB_USER" \
  "$DB_NAME" \
  --format=custom \
  --no-owner \
  --no-acl \
  > "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"

# Compress
gzip -f "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"

# Verify backup is not empty
if [ -s "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump.gz" ]; then
  echo "[$(date)] Backup created: ${DB_NAME}_${TIMESTAMP}.dump.gz ($(du -h "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump.gz" | cut -f1))"
else
  echo "[$(date)] ERROR: Backup file is empty!"
  exit 1
fi

# Delete backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "${DB_NAME}_*.dump.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup complete. Retention: $RETENTION_DAYS days"
```

**Set up cron to run daily at 3 AM:**

```bash
sudo crontab -e
# Add:
0 3 * * * /opt/skoolar/scripts/backup.sh >> /var/log/skoolar-backup.log 2>&1
```

### Step 13.2: Offsite backup to R2

Upload backups to Cloudflare R2 for offsite storage:

```bash
#!/bin/bash
# /opt/skoolar/scripts/backup-to-r2.sh
# Requires: rclone or aws-cli configured with R2 credentials

# Using aws-cli (S3-compatible API)
aws s3 cp \
  /opt/skoolar/data/backups/ \
  s3://skoolar-backups/database/ \
  --recursive \
  --endpoint-url=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com

# Verify
aws s3 ls s3://skoolar-backups/database/ \
  --endpoint-url=https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
```

### Step 13.3: Restore from backup

```bash
#!/bin/bash
# /opt/skoolar/scripts/restore.sh
# Usage: ./restore.sh backup-file.dump.gz

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file.dump.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "File not found: $BACKUP_FILE"
  exit 1
fi

echo "[$(date)] Restoring from $BACKUP_FILE..."

# Decompress
gunzip -c "$BACKUP_FILE" > /tmp/restore_temp.dump

# Copy to container
docker compose cp /tmp/restore_temp.dump postgres:/tmp/

# Restore
docker compose exec postgres pg_restore \
  --clean \
  --if-exists \
  --dbname=postgresql://skoolar:YOUR_PASSWORD@localhost:5432/skoolardb \
  --no-owner \
  --no-acl \
  --verbose \
  /tmp/restore_temp.dump

# Clean up
rm /tmp/restore_temp.dump
echo "[$(date)] Restore complete!"
```

### Step 13.4: Quick checklist for safe restores

- [ ] Stop the app: `docker compose stop app socketio`
- [ ] Take a current backup: `docker compose exec postgres pg_dump -U skoolar skoolardb > pre-restore-backup.sql`
- [ ] Run restore script
- [ ] Start the app: `docker compose start app socketio`
- [ ] Verify data: hit `/api/health` or query a few tables

---

## 14. Security Hardening

### Step 14.1: Fail2ban

```bash
sudo apt install -y fail2ban

sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

Add/modify:

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
```

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo fail2ban-client status
```

### Step 14.2: Secure Docker

```bash
# Don't expose Docker ports publicly
# Only use 127.0.0.1:PORT or use Docker internal networking

# Verify no public ports:
netstat -tlnp | grep LISTEN

# Any service that shows 0.0.0.0:PORT should only be on localhost
# unless it's intentionally public (like the Next.js app via tunnel)
```

### Step 14.3: Secure PostgreSQL

```bash
# PostgreSQL is only available on Docker network (not public)
# In docker-compose.yml: "127.0.0.1:5432:5432" means localhost only

# Set a strong password!
# Change default:
docker compose exec postgres psql -U skoolar -c "ALTER USER skoolar PASSWORD 'NEW_STRONG_PASSWORD';"
```

### Step 14.4: Regular security updates

```bash
# Enable automatic updates
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Manual updates (run monthly)
sudo apt update && sudo apt upgrade -y && sudo apt autoremove -y

# Update Docker images (quarterly)
docker compose pull
docker compose up -d
```

### Step 14.5: Security checklist

- [ ] SSH is only accessible via Tailscale
- [ ] PasswordAuthentication is disabled in SSH
- [ ] Root login is disabled
- [ ] UFW is enabled and only allows Tailscale SSH
- [ ] No public ports exposed (all behind Cloudflare Tunnel)
- [ ] PostgreSQL is bound to localhost only
- [ ] Database has a strong password
- [ ] Fail2ban is running
- [ ] Automatic security updates are enabled
- [ ] Docker containers are regularly updated
- [ ] Backups are encrypted (or to R2 with bucket-level access control)

---

## 15. Daily/Weekly Management Tasks

### Daily (2 minutes)

```bash
# Check services are running
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check disk space
df -h /

# Quick health check
curl -s http://localhost:3000/api/health | jq .
```

### Weekly (5 minutes)

```bash
# Check logs for errors
docker compose logs --since=7d app | grep -i error | tail -20

# Vacuum database
docker compose exec postgres psql -U skoolar -d skoolardb -c "VACUUM ANALYZE;"

# Check backup integrity
ls -lh /opt/skoolar/data/backups/
```

### Monthly (10 minutes)

```bash
# System updates
sudo apt update && sudo apt upgrade -y && sudo apt autoremove -y
sudo systemctl reboot  # If kernel updated

# Docker image updates
docker compose pull
docker compose up -d

# Review logs
sudo journalctl --since="1 month ago" | grep -i "error\|fail\|oom" | tail -30

# Check database size growth
docker compose exec postgres psql -U skoolar -d skoolardb -c "
  SELECT
    pg_size_pretty(pg_database_size('skoolardb')) as size,
    now() as checked_at;
"

# Renew Let's Encrypt (if using Traefik)
# Traefik auto-renews, but verify: docker compose logs traefik | grep -i renew
```

### Quarterly (30 minutes)

```bash
# Full system audit
# - Review fail2ban bans: sudo fail2ban-client status sshd
# - Review SSH auth logs: sudo grep "Failed password" /var/log/auth.log | wc -l
# - Review Docker resource usage: docker stats --no-stream
# - Test backup restoration (on a test container)

# Security audit scripts:
# 1. Lynis: sudo apt install lynis && sudo lynis audit system
# 2. Check for unused Docker images: docker image prune -a
# 3. Review Cloudflare Tunnel logs
```

---

## 16. Troubleshooting

### Common Issues & Solutions

#### "Container keeps restarting"

```bash
# Check logs
docker compose logs app --tail=50

# Common causes:
# - DATABASE_URL is wrong
# - PostgreSQL not ready yet
# - Out of memory

# Fix: check .env, restart postgres first, then app
docker compose restart postgres
sleep 5
docker compose restart app
```

#### "Database connection refused"

```bash
# Is PostgreSQL running?
docker compose ps postgres

# Check logs
docker compose logs postgres --tail=30

# Test connection from app container
docker compose exec app sh -c "nc -zv postgres 5432"

# Common causes:
# - PostgreSQL not started
# - Wrong password
# - Wrong hostname (should be "postgres", not "localhost")
```

#### "Cloudflare Tunnel not working"

```bash
# Check tunnel status
cloudflared tunnel list
cloudflared tunnel info skoolar

# Check logs
sudo journalctl -u cloudflared --tail=50

# Restart tunnel
sudo systemctl restart cloudflared

# Test ingress rules
curl -H "Host: www.skoolar.org" http://localhost:3000
curl -H "Host: livekit.skoolar.org" http://localhost:7880
```

#### "Email not delivering"

```bash
# Check Postfix logs
sudo tail -f /var/log/mail.log

# Test local delivery
echo "test" | mail -s "test" root

# Check queue
mailq

# Flush queue
sudo postfix flush

# Common causes:
# - SMTP relay credentials wrong
# - DNS records not set (SPF, DKIM)
# - Port 587 blocked
# - Postfix not running: sudo systemctl status postfix
```

#### "LiveKit connection failing"

```bash
# Is LiveKit running?
curl http://localhost:7880/rtc/health

# Check logs
docker compose logs livekit --tail=30

# Test token generation
docker compose exec app sh -c "
  node -e \"
    const { generateLiveKitToken } = require('./src/lib/livekit');
    const token = generateLiveKitToken('test-user', 'test-room');
    console.log('Token:', token.toJwt());
  \"
"

# Common causes:
# - LIVEKIT_URL in .env doesn't match public URL
# - TURN server not running
# - UDP ports not open (Cloudflare Tunnel needs HTTP2 mode)
```

#### "Out of disk space"

```bash
# Check disk usage
df -h
du -sh /opt/skoolar/data/* | sort -rh

# Clean Docker
docker system prune -f
docker image prune -a -f

# Clean old backups
find /opt/skoolar/data/backups -name "*.dump.gz" -mtime +30 -delete

# Clean Docker build cache
docker builder prune -f

# Check PostgreSQL data size
docker compose exec postgres du -sh /var/lib/postgresql/data
```

#### "App crashes with OOM"

```bash
# Check memory usage
docker stats --no-stream

# View OOM killer logs
sudo dmesg | grep -i "killed process"

# Solutions:
# - Reduce Docker memory limits in docker-compose.yml
# - Add swap space:
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 17. Appendix: Useful Commands

### Quick Reference

```bash
# ─── Service Management ───
docker compose up -d                 # Start all services
docker compose down                  # Stop all services
docker compose restart [service]     # Restart a service
docker compose logs -f [service]     # Follow logs
docker compose ps                    # List running services

# ─── PostgreSQL ───
docker compose exec postgres psql -U skoolar -d skoolardb
docker compose exec postgres pg_dump -U skoolar skoolardb > backup.sql
docker compose exec postgres pg_restore -U skoolar -d skoolardb backup.sql

# ─── App ───
docker compose exec app npx prisma db push
docker compose exec app npx prisma studio
docker compose exec app node -e "console.log('hello')"

# ─── Networking ───
tailscale status                     # List Tailscale devices
tailscale ip -4                      # Show VM's Tailscale IP
cloudflared tunnel list              # List tunnels
sudo systemctl status cloudflared    # Check tunnel status

# ─── System ───
htop                                 # Interactive process viewer
df -h                                # Disk usage
free -h                              # Memory usage
sudo journalctl -xe                  # System logs
sudo tail -f /var/log/syslog         # System log tail

# ─── Docker Cleanup ───
docker system df                     # Docker disk usage
docker system prune                  # Clean unused data
docker image prune -a                # Remove unused images
docker volume prune                  # Remove unused volumes

# ─── Docker Update ───
docker compose pull                  # Pull latest images
docker compose build --no-cache app  # Rebuild app from scratch
docker compose up -d                 # Apply updates

# ─── Backup & Restore ───
# Manual backup:
docker compose exec postgres pg_dump -U skoolar skoolardb --format=custom > manual_backup_$(date +%Y%m%d).dump

# Manual restore:
docker compose exec -T postgres pg_restore -U skoolar -d skoolardb --clean < manual_backup_20250101.dump

# ─── SSL / TLS ───
# Check certificate expiry:
echo | openssl s_client -servername skoolar.org -connect skoolar.org:443 2>/dev/null | openssl x509 -noout -dates

# ─── Network Diagnostics ───
nc -zv localhost 3000               # Check if port is open
curl -v http://localhost:3000        # Test HTTP response
tracepath skoolar.org                # Network path tracing
```

---

## Final Notes

1. **Everything in this guide is free forever** on Oracle Cloud Free Tier + Cloudflare.
2. **Start with Phase 1 (R2)** since it's simplest and doesn't require the VM.
3. **Test each phase** before moving to the next. You can always revert to Neon/Resend/Cloudinary by changing the `.env` values.
4. **Keep your old services running** during migration. The app handles both old and new URLs/formats.
5. **Join the Oracle Cloud Free Tier community** at r/oraclecloud for tips and support.
6. **Questions?** Reach out via the Skoolar support channels.

---

*Last updated: June 2026*
