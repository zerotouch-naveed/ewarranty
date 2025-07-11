# 🚀 Quick Start Guide

## Issues Fixed ✅

The following issues have been resolved:

### 1. **Mongoose Duplicate Index Warnings**
- ✅ Removed duplicate index definitions
- ✅ Cleaned up schema indexes

### 2. **Error Handler Import Issue**  
- ✅ Fixed error handler export/import
- ✅ Updated app.js to use correct destructuring

### 3. **Missing Uploads Directory**
- ✅ Created uploads directory
- ✅ Added automatic directory creation in app.js

### 4. **Missing Dependencies**
- ✅ Added pino-pretty for development logging
- ✅ Updated package.json

## 📋 Prerequisites

### Install MongoDB

#### **Option 1: Using Docker (Recommended)**
```bash
# Start MongoDB with Docker
docker run -d -p 27017:27017 --name warranty-mongo mongo:6.0

# Or use the provided docker-compose
docker-compose up -d mongo
```

#### **Option 2: Install MongoDB Locally**

**Ubuntu/Debian:**
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Create list file
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Update package database
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS:**
```bash
# Install with Homebrew
brew tap mongodb/brew
brew install mongodb-community@6.0

# Start MongoDB
brew services start mongodb/brew/mongodb-community@6.0
```

**Windows:**
Download from [MongoDB Official Site](https://www.mongodb.com/try/download/community)

## 🚀 Start the Application

### Method 1: Manual Setup
```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

### Method 2: Docker Compose (Everything included)
```bash
# Start all services (app + MongoDB + Mongo Express)
docker-compose up

# Or run in background
docker-compose up -d
```

## 🌐 Access the Application

Once running, you can access:

- **API Server**: http://localhost:3000
- **API Documentation**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health
- **Mongo Express** (if using Docker): http://localhost:8081

## 🔧 Verify Installation

### Test the Health Endpoint
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "database": "connected",
  "uptime": 123.456
}
```

### Test API Documentation
Open http://localhost:3000/docs in your browser

## 🐛 Troubleshooting

### Common Issues:

#### 1. **MongoDB Connection Error**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Ensure MongoDB is running
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Or start MongoDB
sudo systemctl start mongod
```

#### 2. **Port Already in Use**
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:** Change port in .env file
```env
PORT=3001
```

#### 3. **Missing Dependencies**
```
Error: Cannot find module 'pino-pretty'
```
**Solution:** Install dependencies
```bash
npm install
```

## 📝 Environment Configuration

Create `.env` file with:
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/warranty_management
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
```

## 🎯 Next Steps

1. **Test API Endpoints** using Swagger UI
2. **Create a Company** via API
3. **Register Users** with hierarchy
4. **Set up Key Allocation**
5. **Create Customer Warranties**

## 📞 Need Help?

- Check the main README.md for detailed documentation
- Visit http://localhost:3000/docs for API reference
- Create an issue if you encounter problems