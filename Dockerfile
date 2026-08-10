FROM node:20-bookworm

# Install system dependencies (git, ffmpeg, curl, imagemagick, webp, build tools for C++ addons like better-sqlite3)
RUN apt-get update && \
    apt-get install -y \
    git \
    ffmpeg \
    curl \
    imagemagick \
    webp \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install PM2 globally
RUN npm install -g pm2

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install project dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 5000

# Start the application using PM2 runtime
CMD ["pm2-runtime", "start", "index.js", "--name", "mega-md", "--output", "/dev/stdout", "--error", "/dev/stderr"]
