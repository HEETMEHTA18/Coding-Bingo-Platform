# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Neon Database**: Set up your PostgreSQL database at [neon.tech](https://neon.tech)
3. **GitHub Repository**: Your code should be pushed to GitHub

## Environment Variables

Set these environment variables in your Vercel project settings:

### Required Variables:
- `DATABASE_URL`: Your Neon PostgreSQL connection string
- `ADMIN_SECRET`: A secure random string (use: `JRhnK7bMgBtLwzA8myrZIY5UN219DofF`)

### Optional Variables:
- `NODE_ENV`: Set to `production`
- `PG_MAX_POOL`: Database connection pool size (default: 10)
- `PG_IDLE_TIMEOUT`: Connection idle timeout (default: 30000)
- `PG_CONNECTION_TIMEOUT`: Connection timeout (default: 10000)
- `RATE_LIMIT_WINDOW_MS`: Rate limiting window (default: 900000)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 5000)

## Deployment Steps

### Option 1: Deploy from GitHub (Recommended)

1. **Connect Repository**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project**:
   - **Framework Preset**: Select "Other"
   - **Root Directory**: Leave as `./`
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `dist/spa`

3. **Add Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all required variables listed above

4. **Deploy**:
   - Click "Deploy"
   - Vercel will automatically build and deploy your app

### Option 2: Deploy with Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Add Environment Variables**:
   ```bash
   vercel env add DATABASE_URL
   vercel env add ADMIN_SECRET
   ```

## API Routes

Your API will be available at:
- `https://your-app.vercel.app/api/admin/create-room`
- `https://your-app.vercel.app/api/admin/state`
- `https://your-app.vercel.app/api/leaderboard`
- etc.

## Database Setup

1. **Run Migrations** (if needed):
   ```bash
   npm run migrate
   ```

2. **Generate Schema** (if needed):
   ```bash
   npm run generate
   ```

## Troubleshooting

### Build Issues:
- Check that `dist/spa` directory is created after build
- Verify all dependencies are installed

### API Issues:
- Check environment variables are set correctly
- Verify database connection string is valid
- Check Vercel function logs for errors

### Database Issues:
- Ensure Neon database allows connections from Vercel
- Check database URL format
- Verify SSL settings

## Post-Deployment

1. **Test the Application**:
   - Visit your deployed URL
   - Try creating a room
   - Check admin functionality

2. **Monitor Logs**:
   - Use Vercel dashboard to check function logs
   - Monitor for any runtime errors

3. **Custom Domain** (Optional):
   - Add custom domain in Vercel project settings
   - Configure DNS settings as instructed