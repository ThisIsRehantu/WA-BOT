# Pakai Node.js 20 biar sesuai requirement
FROM node:20

# Set working directory
WORKDIR /app

# Copy file dependency dulu (biar cache lebih efisien)
COPY package*.json ./

# Install dependencies (pakai legacy biar aman)
RUN npm install --legacy-peer-deps

# Copy semua file project
COPY . .

# Expose port (Railway biasanya butuh walau WA bot gak pakai port)
EXPOSE 3000

# Start bot
CMD ["node", "index.js"]
