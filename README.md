# Server E-commerce Backend

Backend cho hệ thống thương mại điện tử, xây bằng Node.js, Express và MongoDB, có hỗ trợ realtime, queue worker, thanh toán VNPay, chatbot gợi ý sản phẩm và monitoring.

## Tổng quan

Backend này cung cấp REST API cho các nghiệp vụ chính của hệ thống bán hàng:

- Xác thực người dùng bằng JWT access/refresh token.
- Quản lý sản phẩm, danh mục, shop, banner, voucher, giỏ hàng, wishlist và đánh giá.
- Xử lý đơn hàng, thanh toán VNPay, thống kê và cài đặt hệ thống.
- Thông báo realtime và chat qua Socket.IO.
- Queue worker với RabbitMQ cho các tác vụ bất đồng bộ.
- Redis cho cache và mở rộng Socket.IO adapter.
- Chatbot/RAG dùng Mistral + LangChain để gợi ý sản phẩm.
- Metrics Prometheus để tích hợp Grafana dashboard.

## Quick Start

### Yêu cầu

- Node.js 20+
- npm 10+
- MongoDB
- Redis
- RabbitMQ

Cloudinary, SMTP, VNPay và Mistral API là tùy chọn theo tính năng bạn muốn bật.

### Chạy local

1. Cài dependencies:

```bash
npm install
```

2. Tạo file `.env` trong thư mục `server-ecommerce`.

3. Khai báo tối thiểu các biến sau:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ecommerce
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_URL=amqp://localhost:5672
```

4. Chạy development server:

```bash
npm run dev
```

5. Kiểm tra:

- API health: `GET http://localhost:5000/`
- Metrics: `GET http://localhost:5000/metrics` nếu `METRICS_ENABLED=true`

## Chạy bằng Docker Compose

Repo gốc đã có file compose tại `C:\Users\cyhin\project\docker-compose.yaml` để dựng toàn bộ stack:

- `client`
- `server`
- `mongodb`
- `redis`
- `rabbitmq`
- `prometheus`
- `grafana`
- `elasticsearch`
- `kibana`
- `logstash`

Chạy từ thư mục `C:\Users\cyhin\project`:

```bash
docker compose up -d --build
```

Các địa chỉ mặc định:

- Backend API: `http://localhost:5000`
- Frontend: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
- RabbitMQ Management: `http://localhost:15672`
- Elasticsearch: `http://localhost:9200`
- Kibana: `http://localhost:5601`

Lưu ý:

- Container backend đang chạy kèm `npm run seed:dev:quick` trước khi start.
- `ENABLE_CLUSTER=false` được set sẵn trong compose để metrics và process model ổn định hơn khi chạy container.

## Tính năng chính

### API nghiệp vụ

- Auth
- Users
- Products
- Categories
- Shops
- Shop categories
- Cart
- Orders
- Payment
- Reviews
- Vouchers
- Wishlist
- Banners
- Notifications
- Statistics
- Search
- Settings
- Shipping
- Permissions
- Flash sale
- Recommendations
- Chat
- Chatbot

Toàn bộ route được mount dưới prefix `/api`.

### Realtime và background jobs

- Socket.IO cho chat và notification.
- Redis adapter cho Socket.IO khi bật `SOCKET_REDIS_ADAPTER`.
- RabbitMQ exchange/topic + retry queue + dead-letter queue cho `notification` và `order`.
- Worker được khởi tạo cùng lúc khi server boot.

### AI và tìm kiếm

- Chatbot dùng Mistral qua LangChain.
- Lưu lịch sử hội thoại trong MongoDB.
- Có semantic search/gợi ý sản phẩm qua embedding service.
- Có script khởi tạo embeddings phục vụ chatbot/tìm kiếm.

### Observability và hardening

- `helmet`, `cors`, sanitize input, validation middleware.
- Morgan logging ở môi trường development hoặc khi bật bằng env.
- Prometheus metrics qua endpoint `/metrics`.
- Graceful shutdown cho HTTP server, Socket.IO, MongoDB, Redis và RabbitMQ.
- Hỗ trợ cluster trong production qua `WEB_CONCURRENCY`.

## Scripts

| Script | Mục đích |
| --- | --- |
| `npm start` | Chạy server production |
| `npm run dev` | Chạy server với nodemon |
| `npm test` | Chạy toàn bộ test bằng Vitest |
| `npm run test:watch` | Chạy test watch mode |
| `npm run test:coverage` | Chạy test và đo coverage |
| `npm run lint` | Kiểm tra lint |
| `npm run lint:fix` | Tự sửa lỗi lint cơ bản |
| `npm run format` | Format toàn bộ project |
| `npm run format:check` | Kiểm tra format |
| `npm run seed:dev` | Seed dữ liệu dev đầy đủ |
| `npm run seed:dev:quick` | Seed dữ liệu dev nhanh |
| `npm run seed:dev:reset` | Reset rồi seed lại dữ liệu dev |

## Cấu hình môi trường

### Nhóm bắt buộc để chạy tối thiểu

| Biến | Mô tả |
| --- | --- |
| `PORT` | Cổng chạy backend |
| `NODE_ENV` | Môi trường chạy (`development`, `production`) |
| `MONGODB_URI` | Chuỗi kết nối MongoDB |
| `JWT_ACCESS_SECRET` | Secret ký access token |
| `JWT_REFRESH_SECRET` | Secret ký refresh token |
| `JWT_ACCESS_EXPIRES_IN` | Thời gian sống access token |
| `JWT_REFRESH_EXPIRES_IN` | Thời gian sống refresh token |
| `FRONTEND_URL` | Origin frontend cho CORS và Socket.IO |

### MongoDB

Bạn có thể dùng `MONGODB_URI` hoặc cấu hình theo từng phần:

- `MONGODB_HOST`
- `MONGODB_PORT`
- `MONGODB_DATABASE`
- `MONGODB_USER`
- `MONGODB_PASSWORD`
- `MONGODB_AUTH_SOURCE`
- `MONGO_MIN_POOL_SIZE`
- `MONGO_MAX_POOL_SIZE`
- `MONGO_MAX_CONNECTING`

### Redis

| Biến | Mô tả |
| --- | --- |
| `REDIS_URL` | URL Redis đầy đủ |
| `REDIS_HOST` | Host Redis nếu không dùng `REDIS_URL` |
| `REDIS_PORT` | Port Redis |
| `REDIS_PASSWORD` | Password Redis |
| `SOCKET_REDIS_ADAPTER` | Bật/tắt Redis adapter cho Socket.IO |

### RabbitMQ

| Biến | Mô tả |
| --- | --- |
| `RABBITMQ_URL` | URL kết nối RabbitMQ |
| `RABBITMQ_EXCHANGE` | Exchange chính |
| `RABBITMQ_DLX` | Dead-letter exchange |
| `RABBITMQ_HEARTBEAT_INTERVAL_IN_SECONDS` | Heartbeat interval |
| `RABBITMQ_RECONNECT_DELAY_MS` | Thời gian reconnect |
| `RABBITMQ_CONNECT_TIMEOUT_MS` | Timeout kết nối |
| `NOTIFICATION_RETRY_DELAY_MS` | Delay retry queue notification |
| `NOTIFICATION_MAX_RETRIES` | Số lần retry notification |
| `ORDER_RETRY_DELAY_MS` | Delay retry queue order |
| `ORDER_MAX_RETRIES` | Số lần retry order |

### Upload và media

| Biến | Mô tả |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `UPLOAD_ALLOWED_MIME` | Danh sách MIME được phép upload |
| `UPLOAD_MAX_FILES` | Số file tối đa mỗi request |
| `UPLOAD_MAX_MB` | Kích thước tối đa mỗi file |

### Email

| Biến | Mô tả |
| --- | --- |
| `EMAIL_HOST` | SMTP host |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_SECURE` | Bật TLS/SSL |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password |
| `EMAIL_FROM` | Email người gửi |
| `EMAIL_BASE_URL` | Base URL dùng trong email |
| `EMAIL_MAX_CONNECTIONS` | Số kết nối SMTP tối đa |
| `EMAIL_MAX_MESSAGES` | Số message tối đa mỗi connection |

### Thanh toán

| Biến | Mô tả |
| --- | --- |
| `SERVER_URL` | Base URL backend |
| `VNP_TMNCODE` | Mã terminal VNPay |
| `VNP_HASHSECRET` | Secret VNPay |
| `VNP_RETURN_URL` | URL callback sau thanh toán |

### AI / Chatbot

| Biến | Mô tả |
| --- | --- |
| `MISTRAL_API_KEY` | API key cho chatbot/embedding service |

### Metrics, logging và runtime tuning

| Biến | Mô tả |
| --- | --- |
| `METRICS_ENABLED` | Bật endpoint Prometheus |
| `METRICS_DEFAULTS_ENABLED` | Bật default metrics |
| `METRICS_PREFIX` | Prefix tên metrics |
| `MORGAN_ENABLED` | Bật morgan logger |
| `MORGAN_FORMAT` | Format log của morgan |
| `EXPOSE_ERROR_DETAILS` | Trả chi tiết lỗi ra response |
| `TRUST_PROXY` | Cấu hình trust proxy cho Express |
| `KEEP_ALIVE_TIMEOUT_MS` | HTTP keep-alive timeout |
| `HEADERS_TIMEOUT_MS` | Header timeout |
| `REQUEST_TIMEOUT_MS` | Request timeout |
| `SHUTDOWN_TIMEOUT_MS` | Timeout graceful shutdown |
| `ENABLE_CLUSTER` | Bật cluster mode trong production |
| `WEB_CONCURRENCY` | Số worker process |
| `TXN_MAX_RETRIES` | Retry cho transaction logic |
| `TXN_RETRY_DELAY_MS` | Delay giữa các lần retry transaction |
| `BCRYPT_SALT_ROUNDS` | Salt rounds cho bcrypt |
| `SEED_RESET_OK` | Cho phép reset dữ liệu khi seed |

## Testing

Project dùng Vitest và đã có cả `unit` lẫn `integration` tests trong thư mục `tests/`.

Chạy toàn bộ test:

```bash
npm test
```

Chạy coverage:

```bash
npm run test:coverage
```

## Monitoring

Khi bật `METRICS_ENABLED=true`, backend expose endpoint:

```bash
GET /metrics
```

Monitoring stack trong repo gốc đã cấu hình sẵn Prometheus và Grafana. Grafana mặc định:

- User: `admin`
- Password: `admin123`

Nên override bằng `GRAFANA_ADMIN_USER` và `GRAFANA_ADMIN_PASSWORD` trước khi dùng ngoài môi trường local/dev.

## Cấu trúc thư mục

```text
src/
  app.js                # Khởi tạo Express app và middleware
  server.js             # Boot server, cluster, graceful shutdown
  configs/              # Cấu hình Cloudinary, Redis, RabbitMQ, upload...
  controllers/          # Xử lý request/response
  db/                   # Kết nối MongoDB
  emails/               # Template email
  middlewares/          # Auth, validate, error handler, sanitize...
  models/               # Mongoose models
  monitoring/           # Prometheus metrics
  repositories/         # Data access layer
  routes/               # Định nghĩa route modules
  scripts/              # Seed, migration, embeddings
  services/             # Business logic
  shared/               # Shared helpers/response format
  socket/               # Socket.IO handlers
  utils/                # Utility functions
  validations/          # Joi/schema validations
  workers/              # RabbitMQ consumers/workers
tests/
  unit/                 # Unit tests
  integration/          # Integration tests
```

## Ghi chú triển khai

- Production có thể bật cluster bằng `ENABLE_CLUSTER=true`.
- Nếu chạy nhiều instance Socket.IO, nên bật Redis adapter.
- Nếu dùng đầy đủ notification/order queue, cần đảm bảo RabbitMQ sẵn sàng trước khi boot app.
- Nếu dùng chatbot, cần `MISTRAL_API_KEY` và dữ liệu embeddings phù hợp trong MongoDB.

## Tài liệu liên quan

- Health check: `GET /`
- Metrics: `GET /metrics`
- Entry point: `src/server.js`
- Route registry: `src/routes/index.js`
