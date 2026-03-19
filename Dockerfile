# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Cài đặt toàn bộ package (bao gồm cả devDependencies để build)
RUN npm ci
COPY . .
# Chạy lệnh build (tạo ra thư mục dist hoặc build)
RUN npm run build

# --- Stage 2: Production ---
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# Cài lại chỉ dependencies của production để giảm dung lượng
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

USER node

# Chỉ copy kết quả đã build từ stage trước (ví dụ thư mục dist)
COPY --from=builder --chown=node:node /app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.js"]
