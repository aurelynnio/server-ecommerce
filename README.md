# E-commerce Backend

REST API và realtime backend cho ứng dụng thương mại điện tử. Dự án dùng Express, MongoDB, Redis, RabbitMQ và Socket.IO; đồng thời tích hợp VNPay, Cloudinary, email SMTP và chatbot gợi ý sản phẩm dùng Mistral.

## Thành phần chính

- **Node.js + Express 5**: REST API dưới prefix `/api`.
- **MongoDB + Mongoose**: dữ liệu nghiệp vụ và lịch sử chatbot.
- **Redis**: OTP, cache và Socket.IO adapter khi chạy nhiều instance.
- **RabbitMQ**: worker cho notification và order event, có retry/DLX.
- **Socket.IO**: chat và notification theo thời gian thực.
- **Cloudinary**: lưu ảnh và file upload.
- **VNPay**: tạo URL thanh toán, return URL và IPN verification.
- **Mistral + LangChain**: chatbot/RAG và semantic product search.

## Yêu cầu

- Node.js 20+
- npm 10+
- MongoDB
- Redis
- RabbitMQ

Để sử dụng đầy đủ tính năng còn cần Cloudinary, SMTP, VNPay và Mistral API key. Server khởi động các RabbitMQ workers cùng lúc với HTTP server, vì vậy RabbitMQ phải sẵn sàng trước khi chạy ứng dụng.

## Khởi động nhanh

```bash
cd server-ecommerce
npm ci
```

Tạo `.env` từ danh sách biến bên dưới. Ví dụ tối thiểu cho môi trường local:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb://localhost:27017/ecommerce
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_URL=amqp://localhost:5672

JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
JWT_ACCESS_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=16d
CHAT_SESSION_SECRET=replace-with-a-third-long-random-secret

FRONTEND_URL=http://localhost:3000
MISTRAL_API_KEY=replace-with-your-key
```

Chạy server:

```bash
npm run dev
```

Health check:

```text
GET http://localhost:5000/
```

> Server mặc định dùng port `3000` nếu không khai báo `PORT`. Docker Compose trong repository gốc đặt `PORT=5000` và expose `5000:5000`.

## Chạy bằng Docker Compose

Từ thư mục gốc của workspace:

```bash
docker compose up -d --build
```

Compose dựng backend cùng MongoDB, Redis và RabbitMQ. Service backend chạy seed nhanh trước khi start. Kiểm tra trạng thái bằng:

```bash
docker compose ps
docker compose logs -f server
```

## API modules

Tất cả routes đều có prefix `/api`.

| Nhóm           | Base path                                                                    | Mục đích                                                                    |
| -------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Authentication | `/api/auth`                                                                  | Đăng ký, đăng nhập, refresh/logout, email verification, reset password, 2FA |
| Users          | `/api/users`                                                                 | Profile, address, avatar và quản trị người dùng                             |
| Catalog        | `/api/products`, `/api/categories`, `/api/banners`                           | Sản phẩm, danh mục và banner                                                |
| Shops          | `/api/shops`, `/api/shop-categories`, `/api/shipping`                        | Đăng ký shop, seller profile, shop category và shipping template            |
| Commerce       | `/api/cart`, `/api/orders`, `/api/payment`, `/api/vouchers`, `/api/wishlist` | Giỏ hàng, đơn hàng, VNPay, voucher, wishlist                                |
| Engagement     | `/api/reviews`, `/api/notifications`, `/api/newsletter`                      | Đánh giá, thông báo và newsletter                                           |
| Discovery      | `/api/search`, `/api/recommendations`, `/api/flash-sale`                     | Tìm kiếm, gợi ý và flash sale                                               |
| Operations     | `/api/statistics`, `/api/settings`, `/api/permissions`                       | Dashboard, cấu hình và RBAC/permission                                      |
| Messaging      | `/api/chat`, `/api/chatbot`                                                  | Chat giữa user/shop và chatbot sản phẩm                                     |

Chi tiết endpoint, method, quyền truy cập và validation nằm tại `src/routes/` và `src/validations/`.

## Authentication và bảo mật

- Access/refresh token được gửi qua cookie `httpOnly`; cookie được bật `secure` trong production và `sameSite=strict`.
- CORS chỉ nhận các origin trong `FRONTEND_URL`/`FRONTEND_URLS` và allowlist cấu hình sẵn.
- Auth, OTP, reset password, chatbot và newsletter có rate limit theo IP.
- OTP bị vô hiệu sau 5 lần nhập sai; reset password trả response trung lập để không lộ email đã đăng ký.
- Chatbot anonymous dùng UUID + cookie JWT HTTP-only. Không thể đọc hoặc xóa lịch sử bằng session ID không thuộc caller.
- Request body/query/params được sanitize và các route có schema Joi; upload giới hạn số lượng/kích thước và kiểm tra chữ ký ảnh.
- Không commit `.env`, credential Cloudinary/VNPay/SMTP/Mistral hoặc JWT secrets.

## Cấu hình môi trường

### Runtime, HTTP và CORS

| Variable                                                            | Mô tả                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `PORT`                                                              | HTTP port, mặc định `3000`                                   |
| `NODE_ENV`                                                          | `development`, `test` hoặc `production`                      |
| `FRONTEND_URL`, `FRONTEND_URLS`                                     | Origin frontend, phân tách bằng dấu phẩy nếu có nhiều origin |
| `TRUST_PROXY`                                                       | Cấu hình Express trust proxy sau reverse proxy/load balancer |
| `MORGAN_ENABLED`, `MORGAN_FORMAT`                                   | Điều khiển request logging                                   |
| `KEEP_ALIVE_TIMEOUT_MS`, `HEADERS_TIMEOUT_MS`, `REQUEST_TIMEOUT_MS` | HTTP timeout tuning                                          |
| `SHUTDOWN_TIMEOUT_MS`                                               | Timeout graceful shutdown                                    |
| `ENABLE_CLUSTER`, `WEB_CONCURRENCY`                                 | Cluster mode trong production                                |
| `EXPOSE_ERROR_DETAILS`                                              | Chỉ bật tạm thời khi debug; không bật ở production           |

### MongoDB, Redis và RabbitMQ

| Nhóm         | Variables                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MongoDB      | `MONGODB_URI` hoặc `MONGODB_HOST`, `MONGODB_PORT`, `MONGODB_DATABASE`, `MONGODB_USER`, `MONGODB_PASSWORD`, `MONGODB_AUTH_SOURCE`; pool: `MONGO_MIN_POOL_SIZE`, `MONGO_MAX_POOL_SIZE`, `MONGO_MAX_CONNECTING` |
| Redis        | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`; Socket adapter: `REDIS_URL`, `SOCKET_REDIS_ADAPTER`                                                                                                            |
| RabbitMQ     | `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_DLX`, `RABBITMQ_HEARTBEAT_INTERVAL_IN_SECONDS`, `RABBITMQ_RECONNECT_DELAY_MS`, `RABBITMQ_CONNECT_TIMEOUT_MS`                                                  |
| Worker retry | `NOTIFICATION_RETRY_DELAY_MS`, `NOTIFICATION_MAX_RETRIES`, `ORDER_RETRY_DELAY_MS`, `ORDER_MAX_RETRIES`                                                                                                       |

### Authentication, media và integrations

| Nhóm              | Variables                                                                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| JWT               | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`                                                          |
| Chatbot session   | `CHAT_SESSION_SECRET` (fallback về access secret nếu không khai báo, nhưng nên đặt secret riêng)                                                      |
| Password          | `BCRYPT_SALT_ROUNDS`                                                                                                                                  |
| Upload            | `UPLOAD_ALLOWED_MIME`, `UPLOAD_MAX_FILES`, `UPLOAD_MAX_MB`, `CHAT_UPLOAD_MAX_FILES`, `CHAT_UPLOAD_MAX_MB`                                             |
| Cloudinary        | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`                                                                                |
| SMTP              | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`, `EMAIL_BASE_URL`, `EMAIL_MAX_CONNECTIONS`, `EMAIL_MAX_MESSAGES` |
| VNPay             | `SERVER_URL`, `VNP_TMNCODE`, `VNP_HASHSECRET`, `VNP_RETURN_URL`                                                                                       |
| Mistral           | `MISTRAL_API_KEY`                                                                                                                                     |
| Order transaction | `TXN_MAX_RETRIES`, `TXN_RETRY_DELAY_MS`                                                                                                               |

## Scripts

| Command                        | Mục đích                                               |
| ------------------------------ | ------------------------------------------------------ |
| `npm start`                    | Chạy production server                                 |
| `npm run dev`                  | Chạy server với nodemon                                |
| `npm run lint`                 | Lint source code                                       |
| `npm run lint:fix`             | Tự sửa lỗi lint có thể sửa an toàn                     |
| `npm run format:check`         | Kiểm tra Prettier                                      |
| `npm run format`               | Format toàn bộ project                                 |
| `npm test`                     | Chạy toàn bộ unit và integration test                  |
| `npm run test:watch`           | Chạy test watch mode                                   |
| `npm run test:coverage`        | Chạy test với coverage                                 |
| `npm run seed:dev`             | Seed dữ liệu development đầy đủ                        |
| `npm run seed:dev:quick`       | Seed nhanh dữ liệu development                         |
| `npm run seed:dev:reset`       | Reset rồi seed lại; chỉ dùng trên database development |
| `npm run benchmark:cv`         | Benchmark cache/HTTP/upload                            |
| `npm run benchmark:autocannon` | Benchmark cache với autocannon                         |
| `npm run benchmark:rabbitmq`   | Load test RabbitMQ                                     |

Các script chuyên dụng khác có trong `src/scripts/`, gồm migration schema/index, khởi tạo embedding, seed products và benchmark query. Đọc source trước khi chạy vì một số script kết nối trực tiếp database hoặc thay đổi dữ liệu.

## Testing và kiểm tra chất lượng

```bash
npm run lint
npm test
npm run format:check
```

Test được chia thành:

```text
tests/
  unit/          # service, validation, middleware, utility
  integration/   # middleware và luồng nghiệp vụ tích hợp
```

## Cấu trúc thư mục

```text
src/
  app.js             # Express app, middleware và error handler
  server.js          # boot, cluster và graceful shutdown
  configs/           # DB-adjacent config, upload, Redis, RabbitMQ, Cloudinary
  controllers/       # HTTP request/response layer
  middlewares/       # auth, ownership, permission, rate limit, validation
  models/            # Mongoose schemas
  repositories/      # data-access layer
  routes/            # REST route modules
  services/          # business logic và integration services
  socket/            # Socket.IO authentication và handlers
  validations/       # Joi schemas và sanitization
  workers/           # RabbitMQ consumers
  scripts/           # seed, migration và benchmark
  utils/             # logger, token/session helpers, shared utilities
tests/
  unit/
  integration/
```

## Production checklist

- Dùng secret riêng, đủ dài cho JWT và `CHAT_SESSION_SECRET`; xoay vòng khi có nguy cơ lộ lọt.
- Đặt `NODE_ENV=production`, HTTPS/reverse proxy đúng và `TRUST_PROXY` phù hợp hạ tầng.
- Cấu hình chính xác `FRONTEND_URL(S)`; không dùng wildcard CORS với credential cookie.
- Đảm bảo MongoDB, Redis và RabbitMQ có authentication, backup và health monitoring.
- Đặt Cloudinary, SMTP, VNPay và Mistral credentials qua secret manager/CI variables.
- Chạy `npm audit --omit=dev`, lint và test trước khi release.
