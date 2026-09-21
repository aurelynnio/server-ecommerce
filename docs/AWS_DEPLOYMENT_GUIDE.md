# CẨM NANG TRIỂN KHAI BACKEND LÊN AWS EC2

### Kiến trúc: Frontend trên Vercel (`nantianshop.tech`) ➔ Backend trên AWS EC2 (`api.nantianshop.tech`)

---

## 1. MÔ HÌNH HOẠT ĐỘNG (VERCEL + AWS EC2)

```
[Khách hàng truy cập Web]
          │
          ▼
https://nantianshop.tech (Frontend trên VERCEL)
          │
          ▼ (Gọi API ngầm / Chat Socket.IO)
https://api.nantianshop.tech (Backend trên AWS EC2)
          │
          ▼ [Elastic IP]
    [AWS EC2 Instance]
    ┌──────────────────────────────────────────────────────────┐
    │  [Nginx Reverse Proxy (Cổng 80 & 443 SSL Certbot)]       │
    │  - Chỉ lắng nghe domain: api.nantianshop.tech            │
    │  - Chuyển tiếp toàn bộ request vào http://127.0.0.1:5000 │
    │                                                          │
    │  [Docker Network: ecommerce-network]                     │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │  [backend_ecommerce:5000] (Express, Socket.IO)    │  │
    │  │      │                 │                 │         │  │
    │  │      ▼                 ▼                 ▼         │  │
    │  │  [mongodb:27017]   [redis:6379]   [rabbitmq:5672]  │  │
    │  └────────────────────────────────────────────────────┘  │
    └──────────────────────────────────────────────────────────┘
```

> **Nguyên tắc cốt lõi:**
>
> - Máy chủ EC2 này **CHỈ LÀ BACKEND API**, không chứa code giao diện.
> - `nantianshop.tech` đã do Vercel quản lý và tự cấp SSL.
> - Nginx trên EC2 **CHỈ CẦN DUY NHẤT 1 DOMAIN** là `api.nantianshop.tech`.

---

## 2. BƯỚC TIẾP THEO 1: CÀI ĐẶT AWS CLI, NGINX VÀ TẠO MẠNG DOCKER

Chạy lần lượt các lệnh sau trên terminal EC2:

```bash
# 1. Cài đặt AWS CLI v2 (Bắt buộc để GitHub Actions deploy được)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip
aws --version

# 2. Cài đặt Nginx & Certbot
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# 3. Bật tường lửa UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# 4. Tạo thư mục làm việc dự án và mạng Docker
sudo mkdir -p /srv/ecommerce
sudo chown -R ubuntu:ubuntu /srv/ecommerce
sudo chmod 755 /srv/ecommerce

docker network create ecommerce-network || true
```

---

## 3. BƯỚC TIẾP THEO 2: CẤU HÌNH DATABASE & BIẾN MÔI TRƯỜNG

### 3.1. Tạo file `/srv/ecommerce/docker-compose.yml`

```bash
nano /srv/ecommerce/docker-compose.yml
```

Dán cấu hình chạy MongoDB, Redis, RabbitMQ:

```yaml
services:
  mongodb:
    image: mongo:7.0
    container_name: mongodb
    restart: unless-stopped
    command: ['mongod', '--wiredTigerCacheSizeGB', '0.75']
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGODB_USER:-admin}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD:-SecretMongoPass2026}
      MONGO_INITDB_DATABASE: ${MONGODB_DATABASE:-ecommerce}
    volumes:
      - mongodb_data:/data/db
    networks:
      - ecommerce-network
    deploy:
      resources:
        limits:
          memory: 1200M
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  redis:
    image: redis:7-alpine
    container_name: redis
    restart: unless-stopped
    command: >
      sh -c '
        if [ -n "$$REDIS_PASSWORD" ]; then
          redis-server --requirepass "$$REDIS_PASSWORD" --maxmemory 200mb --maxmemory-policy allkeys-lru --appendonly yes
        else
          redis-server --maxmemory 200mb --maxmemory-policy allkeys-lru --appendonly yes
        fi
      '
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD:-}
    volumes:
      - redis_data:/data
    networks:
      - ecommerce-network
    deploy:
      resources:
        limits:
          memory: 300M
    healthcheck:
      test:
        [
          'CMD-SHELL',
          'if [ -n "$$REDIS_PASSWORD" ]; then redis-cli -a "$$REDIS_PASSWORD" ping; else redis-cli ping; fi',
        ]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-admin}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS:-SecretRabbitPass2026}
    ports:
      - '127.0.0.1:15672:15672'
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - ecommerce-network
    deploy:
      resources:
        limits:
          memory: 600M
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', '-q', 'ping']
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 25s

volumes:
  mongodb_data:
    name: ecommerce_mongodb_data
  redis_data:
    name: ecommerce_redis_data
  rabbitmq_data:
    name: ecommerce_rabbitmq_data

networks:
  ecommerce-network:
    name: ecommerce-network
```

_(Lưu: `Ctrl + O` -> `Enter`, thoát: `Ctrl + X`)._

Khởi động cụm cơ sở dữ liệu:

```bash
cd /srv/ecommerce
docker compose up -d mongodb redis rabbitmq
docker compose ps
```

---

### 3.2. Tạo file biến môi trường `/home/ubuntu/.env.backend`

```bash
nano /home/ubuntu/.env.backend
```

Dán cấu hình (chú ý mục CORS trỏ về domain Vercel của bạn):

```env
NODE_ENV=production
PORT=5000
TRUST_PROXY=true
ENABLE_CLUSTER=true
WEB_CONCURRENCY=2
ENABLE_SCHEDULER=true
START_QUEUE_WORKERS=true
SOCKET_REDIS_ADAPTER=true
EXPOSE_ERROR_DETAILS=false

# Rate Limiting & Access Logging
DISABLE_RATE_LIMIT=false
MORGAN_ENABLED=true
MORGAN_FORMAT=combined

# Order Ingestion (false = trả về 201 Created trực tiếp cho web checkout)
ASYNC_ORDER_INGESTION=false

# CORS: Cho phép frontend trên Vercel gọi API
FRONTEND_URL=https://nantianshop.tech
FRONTEND_URLS=https://nantianshop.tech,https://www.nantianshop.tech


# Khóa JWT và Chatbot Session (Tạo bằng lệnh: openssl rand -hex 32)
JWT_ACCESS_SECRET=a8f9c0d1e2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9
JWT_REFRESH_SECRET=b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2
CHAT_SESSION_SECRET=c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7

JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=16d
BCRYPT_SALT_ROUNDS=10

# Kết nối cơ sở dữ liệu nội bộ Docker
MONGODB_URI=mongodb://admin:SecretMongoPass2026@mongodb:27017/ecommerce?authSource=admin
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=SecretRedisPass2026
SOCKET_REDIS_ADAPTER=true

RABBITMQ_URL=amqp://admin:SecretRabbitPass2026@rabbitmq:5672
RABBITMQ_EXCHANGE=app.topic
RABBITMQ_DLX=app.topic.dlx
ORDER_WORKER_PREFETCH=50
ORDER_DLQ_PREFETCH=10
NOTIFICATION_WORKER_PREFETCH=50
NOTIFICATION_DLQ_PREFETCH=10

# Cloudinary & AI Mistral
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

MISTRAL_API_KEY=your_mistral_key
MISTRAL_MODEL=mistral-medium-latest

# Email SMTP
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password
EMAIL_FROM="Nantian Shop" <noreply@nantianshop.tech>
EMAIL_BASE_URL=https://nantianshop.tech

# VNPay Payment
SERVER_URL=https://api.nantianshop.tech
VNP_TMNCODE=your_tmn_code
VNP_HASHSECRET=your_hash_secret
VNP_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNP_RETURN_URL=https://nantianshop.tech/payment/vnpay-return

# Tài khoản Admin khởi tạo
ADMIN_EMAIL=admin@nantianshop.tech
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@Nantian2026
```

_(Lưu: `Ctrl + O` -> `Enter`, thoát: `Ctrl + X`)._

Khóa quyền bảo mật:

```bash
chmod 600 /home/ubuntu/.env.backend
```

---

## 4. BƯỚC TIẾP THEO 3: TRỎ DNS, CẤU HÌNH NGINX & SSL CHO `api.nantianshop.tech`

### 4.1. Trỏ DNS

- Domain **`nantianshop.tech`**: Trỏ về **Vercel** (theo hướng dẫn của Vercel).
- Subdomain **`api.nantianshop.tech`**: Thêm bản ghi **A Record**:
  - Host: `api`
  - Points to: `<ELASTIC_IP_CỦA_EC2>`
  - TTL: `300`

### 4.2. Cấu hình Nginx trên EC2 (Chỉ cho backend)

Tạo thư mục certbot:

```bash
sudo mkdir -p /var/www/certbot
```

Mở file cấu hình Nginx:

```bash
sudo nano /etc/nginx/conf.d/ecommerce.conf
```

Dán nội dung duy nhất cho backend:

```nginx
upstream backend_nodes {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name api.nantianshop.tech;

    # Cho phép upload ảnh sản phẩm lên tới 25MB
    client_max_body_size 25M;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files $uri =404;
    }

    location / {
        proxy_pass http://backend_nodes;
        proxy_http_version 1.1;

        # WebSocket headers bắt buộc cho Socket.IO
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        proxy_cache_bypass $http_upgrade;
    }
}
```

_(Lưu: `Ctrl + O` -> `Enter`, thoát: `Ctrl + X`)._

Kiểm tra và kích hoạt:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 4.3. Cấp chứng chỉ SSL HTTPS cho `api.nantianshop.tech`

```bash
sudo certbot --nginx -d api.nantianshop.tech
```

- Nhập email -> Gõ `y` đồng ý -> Chọn chuyển hướng HTTP sang HTTPS.
  Ngay lập tức, `https://api.nantianshop.tech` sẽ có chứng chỉ SSL HTTPS hợp lệ.

---

## 5. BƯỚC TIẾP THEO 4: CẤU HÌNH CI/CD TRÊN GITHUB ACTIONS

### 5.1. Đăng nhập AWS trên máy chủ EC2 (1 lần duy nhất)

Trên terminal EC2, chạy lệnh:

```bash
aws configure
```

- `AWS Access Key ID`: Nhập Access Key của IAM User
- `AWS Secret Access Key`: Nhập Secret Key tương ứng
- `Default region name`: `ap-southeast-1`
- `Default output format`: `json`

### 5.2. Khai báo trên GitHub Repository (Settings -> Secrets and variables -> Actions)

**4 Repository Secrets:**

1. `AWS_ACCESS_KEY_ID`: Access Key ID của IAM User (`AKIA...`)
2. `AWS_SECRET_ACCESS_KEY`: Secret Access Key
3. `EC2_HOST`: Địa chỉ **Elastic IP** của EC2
4. `EC2_SSH_PRIVATE_KEY`: Toàn bộ nội dung file `ecommerce-key.pem`

**3 Repository Variables:**

1. `AWS_REGION`: `ap-southeast-1`
2. `ECR_REPOSITORY`: `backend-ecommerce`
3. `EC2_USER`: `ubuntu`

### 5.3. Kích hoạt Deploy tự động

Trên máy tính của bạn trong thư mục dự án `server-ecommerce`:

```bash
git add .
git commit -m "ci: deploy backend api for nantianshop.tech"
git push origin main
```

Vào tab **Actions** trên GitHub để theo dõi tiến trình build và deploy tự động lên EC2.

---

## 6. BƯỚC TIẾP THEO 5: KHỞI TẠO DỮ LIỆU SAU KHI DEPLOY

Sau khi GitHub Actions báo thành công (dấu tích xanh):
SSH vào EC2 để chạy 2 lệnh khởi tạo:

```bash
ssh -i "path/to/ecommerce-key.pem" ubuntu@<ELASTIC_IP>

# 1. Tạo Index cho MongoDB
docker exec -it backend_ecommerce node src/scripts/migrate-indexes.js

# 2. Tạo tài khoản Admin quản trị
docker exec -it backend_ecommerce node src/scripts/create-admin.js

# 3. Kiểm tra phản hồi của API
curl -i https://api.nantianshop.tech/health/ready
```

Hoàn tất! Frontend trên Vercel của bạn bây giờ chỉ cần gọi API tới `https://api.nantianshop.tech` là hoạt động trơn tru.
