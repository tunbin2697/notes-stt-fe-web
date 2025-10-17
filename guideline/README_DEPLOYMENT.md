# 📚 Notes STT Deployment Guides

Complete deployment documentation and scripts for the Notes STT application (Backend + Frontend).

---

## 📁 Files in This Directory

### 📖 Documentation

| File                       | Purpose                   | When to Use                                            |
| -------------------------- | ------------------------- | ------------------------------------------------------ |
| **DEPLOYMENT.md**          | Backend deployment guide  | Setting up NestJS backend with Docker & webhooks       |
| **FRONTEND_DEPLOYMENT.md** | Frontend deployment guide | Setting up React frontend with static files & webhooks |
| **API_GUIDE.md**           | API documentation         | Understanding GraphQL endpoints                        |

### 📜 Deployment Scripts

| File                   | Purpose                    | Location on Server                            |
| ---------------------- | -------------------------- | --------------------------------------------- |
| **deploy-frontend.sh** | Frontend deployment script | Copy to: `~/projects/notes-stt/notes-stt-fe/` |

> **Note**: Backend deployment script (`deploy.sh`) is in the repository root.

---

## 🚀 Deployment Setup Order

### 1️⃣ Backend First (Required)

Follow **[DEPLOYMENT.md](./DEPLOYMENT.md)** to set up:

- ✅ Nginx web server
- ✅ SSL certificates (Let's Encrypt)
- ✅ Domain configuration
- ✅ Webhook service
- ✅ Docker + PostgreSQL
- ✅ Backend API

**Why first?** Backend setup creates the infrastructure (Nginx, SSL, webhooks) that frontend will use.

### 2️⃣ Frontend Second

Follow **[FRONTEND_DEPLOYMENT.md](./FRONTEND_DEPLOYMENT.md)** to set up:

- ✅ Node.js environment
- ✅ Frontend static file serving
- ✅ Frontend webhook configuration
- ✅ Production environment variables

**Easier setup!** Most infrastructure already exists from backend setup.

---

## 🏗️ Production Architecture

```
Server: notes-stt.baokhangdev.click (Ubuntu 20.04+)
│
├── 🔷 Nginx (Port 80/443)
│   ├── /                  → Static files (React frontend)
│   ├── /graphql           → Proxy to localhost:3000 (Backend API)
│   └── /webhook/*         → Proxy to localhost:9000 (Webhook service)
│
├── 🟦 Backend (Docker Containers)
│   ├── NestJS API         → localhost:3000
│   └── PostgreSQL DB      → localhost:5433
│   Location: ~/projects/notes-stt/notes-stt-be/
│
├── 🟩 Frontend (Static Files)
│   └── Built React app    → /var/www/notes-stt.baokhangdev.click/
│   Location: ~/projects/notes-stt/notes-stt-fe/
│
└── 🟨 Webhook Service (Port 9000)
    └── Triggers: deploy.sh & deploy-frontend.sh
```

---

## 🔄 How Deployment Works

### Backend Deployment Flow

```
1. Developer pushes to production branch (notes-stt-be repo)
2. GitHub sends webhook to: https://notes-stt.baokhangdev.click/webhook/deploy-backend
3. Nginx proxies to webhook service on port 9000
4. Webhook service validates HMAC signature & branch
5. Executes: ~/projects/notes-stt/notes-stt-be/deploy.sh
6. Script:
   - Git pull latest code
   - Copy .env from /etc/notes-stt/
   - Build Docker images
   - Start containers (docker-compose up)
   - Run database migrations
   - Health check /graphql endpoint
7. Deployment complete ✅
```

### Frontend Deployment Flow

```
1. Developer pushes to production branch (notes-stt-fe repo)
2. GitHub sends webhook to: https://notes-stt.baokhangdev.click/webhook/deploy-frontend
3. Nginx proxies to webhook service on port 9000
4. Webhook service validates HMAC signature & branch
5. Executes: ~/projects/notes-stt/notes-stt-fe/deploy-frontend.sh
6. Script:
   - Git pull latest code
   - npm ci (install dependencies)
   - npm run build (create static files)
   - Copy build/* to /var/www/notes-stt.baokhangdev.click/
   - Reload Nginx
7. Deployment complete ✅
```

---

## 🔧 Common Commands Reference

### Backend Commands

```bash
# Manual deployment
cd ~/projects/notes-stt/notes-stt-be
./deploy.sh

# View deployment logs
tail -f ~/projects/notes-stt/notes-stt-be/deploy.log

# Check Docker containers
docker ps
docker-compose ps
docker-compose logs -f backend

# Restart backend
docker-compose restart backend

# Rebuild backend
docker-compose down
docker-compose up -d --build
```

### Frontend Commands

```bash
# Manual deployment
cd ~/projects/notes-stt/notes-stt-fe
./deploy-frontend.sh

# View deployment logs
tail -f ~/projects/notes-stt/notes-stt-fe/deploy.log

# Check deployed files
ls -lah /var/www/notes-stt.baokhangdev.click/

# Manual build & deploy
npm ci
npm run build
sudo cp -r build/* /var/www/notes-stt.baokhangdev.click/
```

### Webhook Service Commands

```bash
# Check webhook service status
sudo systemctl status webhook

# View webhook logs (real-time)
sudo journalctl -u webhook -f

# Restart webhook service
sudo systemctl restart webhook

# Edit webhook configuration
sudo nano /opt/hooks/hooks.json
```

### Nginx Commands

```bash
# Test Nginx configuration
sudo nginx -t

# Reload Nginx (apply config changes)
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View access logs
sudo tail -f /var/log/nginx/notes-stt.baokhangdev.click.access.log

# View error logs
sudo tail -f /var/log/nginx/notes-stt.baokhangdev.click.error.log
```

---

## 🗂️ Server Directory Structure

```
~/projects/notes-stt/
│
├── notes-stt-be/                    # Backend repository
│   ├── deploy.sh                    # Backend deployment script
│   ├── deploy.log                   # Backend deployment logs
│   ├── docker-compose.yml           # Docker services config
│   ├── Dockerfile                   # Backend Docker image
│   ├── .env                         # Auto-copied from /etc/notes-stt/
│   ├── prisma/                      # Database schema & migrations
│   └── src/                         # NestJS source code
│
└── notes-stt-fe/                    # Frontend repository
    ├── deploy-frontend.sh           # Frontend deployment script
    ├── deploy.log                   # Frontend deployment logs
    ├── package.json                 # npm dependencies
    ├── .env.production              # Production environment config
    ├── src/                         # React source code
    └── build/                       # Built files (cleaned after deploy)

/var/www/notes-stt.baokhangdev.click/   # Nginx serves from here
├── index.html
├── static/
│   ├── js/
│   ├── css/
│   └── media/
└── ...

/etc/notes-stt/                      # Protected secrets location
└── .env                             # Backend environment variables

/opt/hooks/                          # Webhook configuration
└── hooks.json                       # Webhook routes & secrets
```

---

## 🆘 Quick Troubleshooting

### Backend Issues

| Problem                   | Solution                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Containers won't start    | Check logs: `docker-compose logs backend`                                                                               |
| Database connection fails | Verify `.env` file exists and has correct `DATABASE_URL`                                                                |
| Health check fails        | Check API: `curl -X POST http://localhost:3000/graphql -H "Content-Type: application/json" -d '{"query":"{ health }"}'` |
| Webhook not triggering    | Verify HMAC secret matches in GitHub & hooks.json                                                                       |

### Frontend Issues

| Problem                | Solution                                             |
| ---------------------- | ---------------------------------------------------- |
| Build fails            | Check Node version: `node --version` (need 18+)      |
| Files not updating     | Clear browser cache, check `/var/www/` has new files |
| API calls fail (CORS)  | Verify backend `CORS_ORIGIN` in `.env`               |
| Webhook not triggering | Check webhook logs: `sudo journalctl -u webhook -f`  |

### Common Commands for Debugging

```bash
# Check if services are running
sudo systemctl status nginx
sudo systemctl status webhook
docker ps

# Check if ports are listening
sudo netstat -tulpn | grep :80     # Nginx HTTP
sudo netstat -tulpn | grep :443    # Nginx HTTPS
sudo netstat -tulpn | grep :3000   # Backend API
sudo netstat -tulpn | grep :9000   # Webhook service

# Test endpoints locally
curl -X POST http://localhost:3000/graphql -H "Content-Type: application/json" -d '{"query":"{ health }"}'  # Backend
curl http://localhost/                                  # Frontend
curl http://localhost:9000/hooks/deploy-backend        # Webhook

# Check disk space
df -h

# Check memory usage
free -h
```

---

## 📊 Monitoring & Logs

### Real-time Monitoring (Multiple Terminals)

**Terminal 1: Webhook activity**

```bash
sudo journalctl -u webhook -f
```

**Terminal 2: Backend deployment**

```bash
tail -f ~/projects/notes-stt/notes-stt-be/deploy.log
```

**Terminal 3: Frontend deployment**

```bash
tail -f ~/projects/notes-stt/notes-stt-fe/deploy.log
```

**Terminal 4: Backend container logs**

```bash
docker-compose -f ~/projects/notes-stt/notes-stt-be/docker-compose.yml logs -f backend
```

**Terminal 5: Nginx access logs**

```bash
sudo tail -f /var/log/nginx/notes-stt.baokhangdev.click.access.log
```

---

## 🔒 Security Checklist

- [ ] Backend `.env` stored in `/etc/notes-stt/` (not in repo)
- [ ] Frontend `.env.production` doesn't contain secrets
- [ ] Webhook secrets are strong (32+ characters)
- [ ] `/opt/hooks/hooks.json` has restricted permissions (chmod 600)
- [ ] SSL certificates are valid and auto-renewing
- [ ] Firewall (UFW) is enabled
- [ ] Non-root user runs Docker
- [ ] Database password is strong
- [ ] JWT secret is strong and unique

---

## 📞 Need Help?

1. **Check the guides:**
   - Backend: [DEPLOYMENT.md](./DEPLOYMENT.md)
   - Frontend: [FRONTEND_DEPLOYMENT.md](./FRONTEND_DEPLOYMENT.md)
   - API: [API_GUIDE.md](./API_GUIDE.md)

2. **Review logs:**
   - Deployment logs in each repo's `deploy.log`
   - Webhook logs: `sudo journalctl -u webhook -f`
   - Nginx logs: `/var/log/nginx/`

3. **Common fixes:**
   - Restart services: `sudo systemctl restart webhook nginx`
   - Rebuild backend: `docker-compose up -d --build`
   - Redeploy frontend: `./deploy-frontend.sh`

---

## ✅ Success Indicators

Your deployment is working when:

- ✅ **Backend API accessible**: `https://notes-stt.baokhangdev.click/graphql`
- ✅ **Frontend loads**: `https://notes-stt.baokhangdev.click`
- ✅ **SSL certificate valid**: Green padlock in browser
- ✅ **Docker containers running**: `docker ps` shows healthy containers
- ✅ **Webhook triggers work**: Push to production branch deploys automatically
- ✅ **No errors in logs**: Clean logs in webhook, Nginx, and deployment logs
- ✅ **API calls work**: Frontend can communicate with backend GraphQL API

---

**Last Updated**: October 2025  
**Repository**: [tunbin2697/notes-stt-be](https://github.com/tunbin2697/notes-stt-be)
