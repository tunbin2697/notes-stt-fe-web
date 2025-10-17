#!/bin/bash

# Frontend deployment script for React static site
# Assumptions:
# - This script is located in the frontend repo root on the deployment host
# - The repo has a `production` branch that contains the code to deploy
# - Node.js and npm are installed globally on the server
# - Nginx is configured to serve from /var/www/notes-stt.baokhangdev.click

set -euo pipefail

BRANCH="production"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_FILE="${REPO_DIR}/deploy.log"
WEB_ROOT="/var/www/notes-stt.baokhangdev.click"
BUILD_DIR="${REPO_DIR}/dist"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN:${NC} $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"; }

log "========================================="
log "🚀 Starting frontend deployment: branch=$BRANCH, repo=$REPO_DIR"
log "========================================="

cd "$REPO_DIR"

# Ensure we have the repository and origin
if [ ! -d .git ]; then
    error "No .git directory found in $REPO_DIR"
    exit 1
fi

log "Fetching latest from origin/$BRANCH"
git fetch --all --prune 2>&1 | tee -a "$LOG_FILE"
log "Fetch completed"

# Checkout and align with remote branch
if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
    log "Checking out existing branch: $BRANCH"
    git checkout "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
else
    log "Creating new local branch: $BRANCH from origin/$BRANCH"
    git checkout -b "$BRANCH" "origin/$BRANCH" 2>&1 | tee -a "$LOG_FILE"
fi

log "Resetting to origin/$BRANCH"
git fetch origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"
git reset --hard "origin/$BRANCH" 2>&1 | tee -a "$LOG_FILE"
log "Cleaning untracked files"
git clean -fdx 2>&1 | tee -a "$LOG_FILE"

CURRENT_COMMIT=$(git rev-parse --short HEAD)
CURRENT_COMMIT_MSG=$(git log -1 --pretty=%B | head -n 1)
log "Repository updated to commit: $CURRENT_COMMIT"
log "Commit message: $CURRENT_COMMIT_MSG"

# Load NVM and Node.js
log "Loading Node.js environment"

# Load NVM if it exists
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    log "Loading NVM from $NVM_DIR"
    . "$NVM_DIR/nvm.sh"
    nvm use default >/dev/null 2>&1 || true
fi

# Add Node.js to PATH (for both NVM and system installations)
if [ -d "$HOME/.nvm/versions/node" ]; then
    LATEST_NODE=$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)
    if [ -n "$LATEST_NODE" ]; then
        export PATH="$HOME/.nvm/versions/node/$LATEST_NODE/bin:$PATH"
        log "Added NVM Node.js to PATH: $LATEST_NODE"
    fi
fi

# Check Node.js and npm
log "Checking Node.js and npm installation"
if ! command -v node >/dev/null 2>&1; then
    error "Node.js is not installed or not accessible."
    error "Current PATH: $PATH"
    error "NVM_DIR: $NVM_DIR"
    exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
    error "npm is not installed or not accessible."
    error "Current PATH: $PATH"
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log "✓ Node.js version: $NODE_VERSION"
log "✓ npm version: $NPM_VERSION"
log "✓ Node.js location: $(which node)"

# Check if package.json exists
if [ ! -f package.json ]; then
    error "package.json not found in $REPO_DIR"
    exit 1
fi

# Install dependencies
log "Installing dependencies with npm ci"
log "This may take a while on first run..."
npm ci 2>&1 | tee -a "$LOG_FILE"
INSTALL_EXIT_CODE=${PIPESTATUS[0]}
if [ $INSTALL_EXIT_CODE -eq 0 ]; then
    log "✓ Dependencies installed successfully"
    PACKAGE_COUNT=$(npm list --depth=0 2>/dev/null | grep -c "├─\|└─" || echo "unknown")
    log "  Packages installed: $PACKAGE_COUNT"
else
    error "Dependency installation failed with exit code $INSTALL_EXIT_CODE"
    exit 1
fi

# Build the React app
log "Building React application for production"
log "Build output:"
log "----------------------------------------"
npm run build 2>&1 | tee -a "$LOG_FILE"
BUILD_EXIT_CODE=${PIPESTATUS[0]}
log "----------------------------------------"

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    log "✓ Build completed successfully"
else
    error "Build failed with exit code $BUILD_EXIT_CODE"
    error "Check the logs above for details"
    exit 1
fi

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    error "Build directory not found at $BUILD_DIR"
    error "Vite build may have failed or output directory is different"
    exit 1
fi

# Check build size
BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
log "Build directory size: $BUILD_SIZE"

# Backup current deployment (optional)
if [ -d "$WEB_ROOT" ] && [ "$(ls -A $WEB_ROOT)" ]; then
    BACKUP_DIR="${WEB_ROOT}_backup_$(date +'%Y%m%d_%H%M%S')"
    log "Creating backup of current deployment"
    sudo cp -r "$WEB_ROOT" "$BACKUP_DIR" 2>&1 | tee -a "$LOG_FILE" || warn "Backup failed, continuing anyway"
    log "✓ Backup created at: $BACKUP_DIR"
    
    # Keep only last 3 backups
    log "Cleaning old backups (keeping last 3)"
    ls -dt ${WEB_ROOT}_backup_* 2>/dev/null | tail -n +4 | xargs sudo rm -rf 2>&1 | tee -a "$LOG_FILE" || true
fi

# Deploy built files
log "Deploying built files to $WEB_ROOT"
log "Removing old files from web root"
sudo rm -rf ${WEB_ROOT}/* 2>&1 | tee -a "$LOG_FILE"

log "Copying new build to web root"
sudo cp -r ${BUILD_DIR}/* ${WEB_ROOT}/ 2>&1 | tee -a "$LOG_FILE"
DEPLOY_EXIT_CODE=$?

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
    log "✓ Files deployed successfully"
else
    error "File deployment failed with exit code $DEPLOY_EXIT_CODE"
    exit 1
fi

# Set correct permissions
log "Setting file permissions"
sudo chown -R www-data:www-data ${WEB_ROOT} 2>&1 | tee -a "$LOG_FILE"
sudo chmod -R 755 ${WEB_ROOT} 2>&1 | tee -a "$LOG_FILE"
log "✓ Permissions set (owner: www-data, mode: 755)"

# Verify deployment
log "Verifying deployment"
if [ -f "${WEB_ROOT}/index.html" ]; then
    log "✓ index.html found in web root"
    FILE_COUNT=$(find ${WEB_ROOT} -type f | wc -l)
    log "  Total files deployed: $FILE_COUNT"
else
    error "index.html not found in web root!"
    error "Deployment may have failed"
    exit 1
fi

# Test if site is accessible locally
log "Testing local HTTP response"
if curl -sf http://localhost/ >/dev/null 2>&1; then
    log "✓ Site responds on http://localhost/"
else
    warn "Site not responding on localhost (Nginx may need reload)"
fi

# Reload Nginx to clear any caches
log "Reloading Nginx"
sudo nginx -t 2>&1 | tee -a "$LOG_FILE"
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    sudo systemctl reload nginx 2>&1 | tee -a "$LOG_FILE"
    log "✓ Nginx reloaded successfully"
else
    error "Nginx configuration test failed"
    exit 1
fi

log "========================================="
log "🎉 FRONTEND DEPLOYMENT FINISHED SUCCESSFULLY"
log "========================================="

log ""
log "Deployment summary:"
log "  Branch: $BRANCH"
log "  Commit: $CURRENT_COMMIT - $CURRENT_COMMIT_MSG"
log "  Build size: $BUILD_SIZE"
log "  Files deployed: $FILE_COUNT files"
log "  Web root: $WEB_ROOT"
log "  Frontend URL: https://notes-stt.baokhangdev.click"
log ""
log "Full logs available at: $LOG_FILE"
log "========================================="

# Clean up build directory to save space (optional)
log "Cleaning build directory from repo"
rm -rf ${BUILD_DIR} 2>&1 | tee -a "$LOG_FILE" || true
log "✓ Build directory cleaned"

exit 0
