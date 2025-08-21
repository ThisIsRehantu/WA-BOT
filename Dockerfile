# Gunakan Node.js versi stabil
FROM node:20

# Buat folder kerja
WORKDIR /app

# Copy package.json & package-lock.json dulu (biar cache efisien)
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy semua file project
COPY . .

# Expose port (Railway perlu ini walau bot WA ga butuh)
EXPOSE 3000

# Start bot
CMD ["npm", "start"]
