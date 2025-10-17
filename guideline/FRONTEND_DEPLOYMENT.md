# 🎨 Frontend Production Deployment Guide

Complete guide for deploying the Notes STT React frontend to production using static files and automated webhooks.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Frontend Deployment Setup](#frontend-deployment-setup)
3. [Webhook Configuration](#webhook-configuration)
4. [Testing Deployment](#testing-deployment)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

- **Server**: Ubuntu 20.04+ (same server as backend)
- **Node.js**: v18+ installed globally
- **Nginx**: Already configured from backend setup
- **Domain**: Same domain as backend (notes-stt.baokhangdev.click)
- **Webhook Service**: Already running from backend setup

### Backend Already Configured ✅

Your server should already have from the backend deployment:

- ✅ Nginx installed and configured
- ✅ SSL certificate (Let's Encrypt)
- ✅ Webhook service running on port 9000
- ✅ Domain DNS configured
- ✅ Firewall configured (UFW)

**Backend is running at:**

- API: `https://notes-stt.baokhangdev.click/graphql`
- Webhook: `https://notes-stt.baokhangdev.click/webhook/`

---

## Frontend Deployment Setup

### 1. Install Node.js (if not already installed)

```bash
# Check if Node.js is installed
node --version
npm --version

# If not installed or version < 18, install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x
```

### 2. Create Frontend Directory Structure

```bash
# Create frontend project directory
mkdir -p ~/projects/notes-stt
cd ~/projects/notes-stt

# Clone frontend repository
git clone https://github.com/YOUR_USERNAME/notes-stt-fe-web.git

# Your structure should look like:
~/projects/notes-stt/
├── notes-stt-be/          # Backend (already exists)
│   ├── deploy.sh
│   ├── docker-compose.yml
│   └── ...
└── notes-stt-fe-web/          # Frontend (new)
    ├── deploy-frontend.sh
    ├── package.json
    ├── src/
    └── public/
```

### 3. Create Frontend Deployment Script

```bash
cd ~/projects/notes-stt/notes-stt-fe-web

# Create deployment script
nano deploy-frontend.sh
```

**Copy the deployment script from your backend repository:**

The `deploy-frontend.sh` script is provided in your repository at `guideline/deploy-frontend.sh`

**Make it executable:**

```bash
chmod +x deploy-frontend.sh
```

### 4. Configure Nginx for Frontend

The backend Nginx config already has a placeholder for frontend. Update it:

```bash
sudo nano /etc/nginx/sites-available/notes-stt.baokhangdev.click
```

**Uncomment and update the frontend section:**

```nginx
server {
    # ... existing SSL and backend config ...

    # ============================================
    # FRONTEND (Static React App)
    # ============================================
    location / {
        root /var/www/notes-stt.baokhangdev.click;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Don't cache index.html
        location = /index.html {
            expires -1;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # ... existing graphql and webhook locations ...
}
```

**Test and reload Nginx:**

```bash
# Test configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

### 5. Create Web Root Directory

```bash
# Create directory for static files
sudo mkdir -p /var/www/notes-stt.baokhangdev.click

# Set ownership to your user
sudo chown -R $USER:$USER /var/www/notes-stt.baokhangdev.click

# Set permissions
chmod -R 755 /var/www/notes-stt.baokhangdev.click
```

### 6. Configure Environment Variables

**Create environment file for production:**

```bash
cd ~/projects/notes-stt/notes-stt-fe-web

# Create .env.production (or update existing)
nano .env.production
```

**Add production configuration:**

```env
# API Configuration
REACT_APP_API_URL=https://notes-stt.baokhangdev.click/graphql
REACT_APP_WS_URL=wss://notes-stt.baokhangdev.click/graphql

# Environment
NODE_ENV=production

# Optional: Analytics, Feature Flags, etc.
# REACT_APP_ANALYTICS_ID=your_analytics_id
```

**Important:** Add `.env.production` to `.gitignore` if it contains sensitive data, or commit it if values are public.

### 7. Test Manual Build

Before setting up automation, test the build manually:

```bash
cd ~/projects/notes-stt/notes-stt-fe-web

# Install dependencies
npm ci

# Build for production
npm run build

# Copy build to web root
sudo rm -rf /var/www/notes-stt.baokhangdev.click/*
sudo cp -r build/* /var/www/notes-stt.baokhangdev.click/

# Test in browser
curl https://notes-stt.baokhangdev.click

# Should return your React app HTML
```

---

## Webhook Configuration

### 1. Update Webhook Configuration

Add frontend webhook to the existing hooks.json:

```bash
sudo nano /opt/hooks/hooks.json
```

**Add frontend webhook to the array:**

```json
[
  {
    "id": "deploy-backend",
    "execute-command": "/home/youruser/projects/notes-stt/notes-stt-be/deploy.sh",
    "command-working-directory": "/home/youruser/projects/notes-stt/notes-stt-be",
    "response-message": "Backend deployment triggered!",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "YOUR_BACKEND_WEBHOOK_SECRET",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/production",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  },
  {
    "id": "deploy-frontend",
    "execute-command": "/home/youruser/projects/notes-stt/notes-stt-fe-web/deploy-frontend.sh",
    "command-working-directory": "/home/youruser/projects/notes-stt/notes-stt-fe-web",
    "response-message": "Frontend deployment triggered!",
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "payload-hmac-sha256",
            "secret": "YOUR_FRONTEND_WEBHOOK_SECRET",
            "parameter": {
              "source": "header",
              "name": "X-Hub-Signature-256"
            }
          }
        },
        {
          "match": {
            "type": "value",
            "value": "refs/heads/production",
            "parameter": {
              "source": "payload",
              "name": "ref"
            }
          }
        }
      ]
    }
  }
]
```

**Generate new webhook secret for frontend:**

```bash
openssl rand -hex 32
# Save this for GitHub webhook configuration
```

**Update paths with your actual username:**

```bash
# Find your home directory
echo $HOME
# Example: /home/ubuntu

# Replace /home/youruser with your actual path in hooks.json
```

**Restart webhook service:**

```bash
sudo systemctl restart webhook
sudo systemctl status webhook
```

### 2. Configure GitHub Webhook for Frontend

1. Go to your **frontend repository** on GitHub
2. **Settings** → **Webhooks** → **Add webhook**
3. Configure:
   - **Payload URL**: `https://notes-stt.baokhangdev.click/webhook/deploy-frontend`
   - **Content type**: `application/json`
   - **Secret**: Paste the frontend webhook secret you generated
   - **Which events**: Select `Just the push event`
   - **Active**: ✅ Checked
4. Click **Add webhook**

---

## Testing Deployment

### Method 1: Manual Test

```bash
cd ~/projects/notes-stt/notes-stt-fe-web
./deploy-frontend.sh
```

**Watch the logs:**

```bash
tail -f ~/projects/notes-stt/notes-stt-fe-web/deploy.log
```

### Method 2: Trigger from GitHub

```bash
# On your local machine
cd /path/to/frontend-repo
git checkout production
git push origin production
```

**Monitor deployment on server:**

```bash
# Terminal 1: Webhook logs
sudo journalctl -u webhook -f

# Terminal 2: Frontend deployment logs
tail -f ~/projects/notes-stt/notes-stt-fe-web/deploy.log
```

### Method 3: Test from GitHub UI

1. Go to repository → Settings → Webhooks
2. Click on your frontend webhook
3. Scroll to "Recent Deliveries"
4. Click "Redeliver"
5. Monitor server logs

### Verify Deployment

```bash
# Check if files are deployed
ls -lah /var/www/notes-stt.baokhangdev.click/

# Test frontend in browser
curl https://notes-stt.baokhangdev.click
# Should return HTML with React app

# Check for static assets
curl https://notes-stt.baokhangdev.click/static/js/main.*.js
# Should return JavaScript bundle
```

**Test in browser:**

- Open: `https://notes-stt.baokhangdev.click`
- Check browser console for errors
- Verify API calls work (should connect to `/graphql`)

---

## Production Checklist

### Before Going Live

- [ ] Node.js installed on server
- [ ] Frontend repository cloned
- [ ] `deploy-frontend.sh` executable
- [ ] `.env.production` configured
- [ ] Nginx frontend location uncommented
- [ ] Web root directory created (`/var/www/notes-stt.baokhangdev.click`)
- [ ] Webhook configuration updated
- [ ] GitHub webhook configured
- [ ] Manual build test successful
- [ ] Frontend accessible via domain

### Post-Deployment Verification

- [ ] Frontend loads in browser
- [ ] No console errors
- [ ] API calls to backend work
- [ ] Static assets load correctly
- [ ] SSL certificate valid
- [ ] Webhook triggers on push

---

## Monitoring

```bash
# Watch frontend deployment logs
tail -f ~/projects/notes-stt/notes-stt-fe-web/deploy.log

# Watch webhook service logs
sudo journalctl -u webhook -f

# Watch Nginx access logs
sudo tail -f /var/log/nginx/notes-stt.baokhangdev.click.access.log

# Watch Nginx error logs
sudo tail -f /var/log/nginx/notes-stt.baokhangdev.click.error.log

# Check build directory size
du -sh /var/www/notes-stt.baokhangdev.click/
```

---

## Troubleshooting

### Problem: "npm: command not found"

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

### Problem: Build fails with memory error

```bash
# Increase Node.js memory limit in deploy script
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Problem: Static files not loading (404 errors)

```bash
# Check file permissions
ls -la /var/www/notes-stt.baokhangdev.click/

# Fix permissions if needed
sudo chown -R $USER:$USER /var/www/notes-stt.baokhangdev.click
chmod -R 755 /var/www/notes-stt.baokhangdev.click

# Check Nginx configuration
sudo nginx -t
sudo systemctl reload nginx
```

### Problem: API calls fail (CORS errors)

Check backend CORS configuration in backend `.env`:

```bash
# On server
cat ~/projects/notes-stt/notes-stt-be/.env | grep CORS_ORIGIN

# Should be: CORS_ORIGIN=https://notes-stt.baokhangdev.click
```

### Problem: Webhook not triggering

```bash
# Check webhook service
sudo systemctl status webhook

# Check webhook logs
sudo journalctl -u webhook -f

# Test webhook manually
curl -X POST http://localhost:9000/hooks/deploy-frontend \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/production"}'
```

### Problem: Old cached files showing

```bash
# Clear browser cache, or check Nginx cache headers
curl -I https://notes-stt.baokhangdev.click/index.html
# Should show: Cache-Control: no-cache, no-store, must-revalidate
```

---

## Architecture Overview

```
GitHub Push (production branch)
        ↓
GitHub Webhook
        ↓
Nginx (:443) → Webhook Service (:9000)
        ↓
deploy-frontend.sh
        ↓
1. Git pull latest code
2. npm ci (install dependencies)
3. npm run build (create static files)
4. Copy build/* to /var/www/notes-stt.baokhangdev.click/
        ↓
Nginx serves static files
        ↓
Users access: https://notes-stt.baokhangdev.click
```

---

## File Structure on Server

```
Server: ~/projects/notes-stt/
│
├── notes-stt-be/                        # Backend (Docker)
│   ├── deploy.sh
│   ├── deploy.log
│   ├── docker-compose.yml
│   └── ...
│
└── notes-stt-fe-web/                        # Frontend (Static)
    ├── deploy-frontend.sh               ← Deployment script
    ├── deploy.log                       ← Deployment logs
    ├── package.json
    ├── .env.production                  ← Production config
    ├── src/
    ├── public/
    └── build/                           ← Built files (gitignored)

Nginx serves from:
/var/www/notes-stt.baokhangdev.click/    ← Static files copied here
├── index.html
├── static/
│   ├── js/
│   ├── css/
│   └── media/
└── ...
```

---

## Summary

Your frontend is now deployed with:

- ✅ React app compiled to static files
- ✅ Nginx serving static content
- ✅ Automated webhook deployment on push to `production`
- ✅ Production environment variables
- ✅ API connection to backend GraphQL
- ✅ SSL/TLS via Let's Encrypt (shared with backend)
- ✅ Efficient caching strategy

**Frontend URL**: `https://notes-stt.baokhangdev.click`

**Backend API**: `https://notes-stt.baokhangdev.click/graphql`

**Webhook URL**: `https://notes-stt.baokhangdev.click/webhook/deploy-frontend`
