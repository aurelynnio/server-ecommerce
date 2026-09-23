# Tài Liệu Toàn Bộ API Endpoints - E-Commerce & AI Shopping Assistant Backend

Tài liệu đặc tả chi tiết toàn bộ các RESTful API endpoints và WebSocket events của hệ thống backend E-Commerce & AI Shopping Assistant.

---

## 1. Thông Tin Chung & Quy Chuẩn Hệ Thống

### 1.1. Base URL

- **Môi trường Development**: `http://localhost:5000` (hoặc `http://localhost:3000`)
- **Tài liệu Swagger OpenAPI UI**: `http://localhost:5000/api-docs` (hoặc chuyển hướng tự động từ `/docs`)

---

### 1.2. Cơ Chế Xác Thực & Phân Quyền (Authentication & Authorization)

Hệ thống sử dụng **JSON Web Token (JWT)** với 2 cơ chế truyền nhận:

1. **HTTP Authorization Header**:
   ```http
   Authorization: Bearer <access_token>
   ```
2. **HttpOnly Cookie**:
   - `accessToken`: Token dùng để xác thực các request cần đăng nhập (thời hạn ngắn).
   - `refreshToken`: Token lưu trong cookie httpOnly bảo mật, dùng tại endpoint `/api/auth/refresh-token` để cấp mới `accessToken`.

**Các vai trò (Roles) trong hệ thống:**

- `Public`: Không yêu cầu đăng nhập.
- `User` (Customer): Người dùng đã đăng nhập.
- `Seller`: Người bán hàng (người dùng sở hữu ít nhất 1 Shop đang hoạt động hoặc có role `seller`).
- `Admin`: Quản trị viên hệ thống có toàn quyền trên nền tảng.

**Hệ thống phân quyền chi tiết (RBAC & Permissions):**

- Ngoài role, hệ thống hỗ trợ kiểm tra quyền chi tiết (e.g. `admin:access`, `seller:access`, ...).
- Header tùy chọn theo dõi request: `X-Request-Id` (UUID v4 tự động sinh nếu client không gửi).

---

### 1.3. Định Dạng Phản Hồi Chuẩn (Standard Response Format)

#### Phản hồi thành công (HTTP 200, 201)

```json
{
  "status": "success",
  "message": "Thao tác thành công",
  "code": 200,
  "data": { ... }
}
```

#### Phản hồi phân trang (Pagination Metadata)

```json
{
  "status": "success",
  "message": "Lấy danh sách thành công",
  "code": 200,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### Phản hồi thất bại (HTTP 400, 401, 403, 404, 409, 429, 500)

```json
{
  "status": "fail",
  "message": "Thông điệp lỗi chi tiết",
  "code": 400
}
```

---

### 1.4. Rate Limiting (Giới hạn tần suất gọi API)

Hệ thống áp dụng Redis-backed rate limiting để chống brute-force và DDoS:

- **Auth Rate Limiter**: Tối đa 10 request / 15 phút (cho đăng ký, đăng nhập, OTP).
- **Password Reset Rate Limiter**: Tối đa 5 request / 60 phút.
- **Chatbot Rate Limiter**: Tối đa 30 request / 10 phút (theo User ID hoặc IP).
- **Newsletter Rate Limiter**: Tối đa 5 request / 60 phút.

---

## 2. Bảng Thống Kê Tổng Hợp Endpoints

| #   | Nhóm Endpoint              | Tiền Tố Đường Dẫn (Prefix) | Số Lượng Endpoints | Đối Tượng Sử Dụng Chính     |
| --- | -------------------------- | -------------------------- | ------------------ | --------------------------- |
| 1   | **System & Monitoring**    | `/`, `/health`, `/metrics` | 4                  | Public, DevOps, Prometheus  |
| 2   | **Authentication & 2FA**   | `/api/auth`                | 13                 | Public, User                |
| 3   | **Users & Addresses**      | `/api/users`               | 16                 | User, Admin                 |
| 4   | **Products & Variants**    | `/api/products`            | 16                 | Public, Seller, Admin       |
| 5   | **Categories**             | `/api/categories`          | 10                 | Public, Admin               |
| 6   | **Shopping Cart**          | `/api/cart`                | 6                  | User                        |
| 7   | **Orders & Fulfillment**   | `/api/orders`              | 11                 | User, Seller, Admin         |
| 8   | **Payments (VNPay)**       | `/api/payment`             | 4                  | Public, User                |
| 9   | **Banners**                | `/api/banners`             | 6                  | Public, Admin               |
| 10  | **Chatbot (AI Assistant)** | `/api/chatbot`             | 9                  | Public, User, Admin         |
| 11  | **Shops (Multi-Vendor)**   | `/api/shops`               | 18                 | Public, User, Seller, Admin |
| 12  | **Shop Categories**        | `/api/shop-categories`     | 5                  | Public, Seller              |
| 13  | **Vouchers & Discounts**   | `/api/vouchers`            | 11                 | Public, User, Seller, Admin |
| 14  | **P2P Chat**               | `/api/chat`                | 6                  | User, Seller                |
| 15  | **Wishlist**               | `/api/wishlist`            | 7                  | User                        |
| 16  | **Search & Discovery**     | `/api/search`              | 4                  | Public                      |
| 17  | **Flash Sale**             | `/api/flash-sale`          | 6                  | Public, Seller, Admin       |
| 18  | **Recommendations**        | `/api/recommendations`     | 7                  | Public, User                |
| 19  | **Permissions & RBAC**     | `/api/permissions`         | 8                  | Public, User, Admin         |
| 20  | **Settings**               | `/api/settings`            | 5                  | Admin                       |
| 21  | **Newsletter**             | `/api/newsletter`          | 1                  | Public                      |
| 22  | **Notifications**          | `/api/notifications`       | 7                  | User, Admin                 |
| 23  | **Reviews & Ratings**      | `/api/reviews`             | 12                 | Public, User, Seller, Admin |
| 24  | **Statistics & BI**        | `/api/statistics`          | 1                  | Admin                       |
| 25  | **WebSocket Events**       | `Socket.io Gateway`        | 8 Events           | User, Seller                |

---

## 3. Đặc Tả Chi Tiết Từng Endpoint

---

### 3.1. System & Monitoring

#### `GET /`

- **Mô tả**: Kiểm tra trạng thái hoạt động cơ bản của API server.
- **Quyền hạn**: `Public`
- **Phản hồi (200)**:
  ```json
  { "status": "API OK" }
  ```

#### `GET /health/live`

- **Mô tả**: Kubernetes / Container Liveness probe. Xác nhận tiến trình Node.js và Event Loop đang hoạt động.
- **Quyền hạn**: `Public`
- **Phản hồi (200)**:
  ```json
  {
    "status": "live",
    "uptime": 3600.5,
    "timestamp": "2026-09-11T06:47:11.000Z"
  }
  ```

#### `GET /health/ready`

- **Mô tả**: Readiness probe kiểm tra kết nối tới MongoDB, Redis và RabbitMQ. Kết quả được cache trong bộ nhớ RAM 10 giây để chống quá tải khi các orchestrator ping liên tục.
- **Quyền hạn**: `Public`
- **Phản hồi (200 - Sẵn sàng)**:
  ```json
  {
    "status": "ready",
    "timestamp": "2026-09-11T06:47:11.000Z",
    "services": {
      "mongodb": "up",
      "redis": "up",
      "rabbitmq": "up"
    }
  }
  ```
- **Phản hồi (503 - Dịch vụ lỗi)**: Khi MongoDB hoặc Redis gặp sự cố.

#### `GET /metrics`

- **Mô tả**: Endpoint thu thập số liệu vận hành chuẩn Prometheus (RED metrics, garbage collection, heap memory, response duration).
- **Quyền hạn**:
  - Trong môi trường development: `Public`.
  - Trong production: Yêu cầu Header `Authorization: Bearer <METRICS_BEARER_TOKEN>` hoặc IP nằm trong danh sách trắng `METRICS_ALLOWED_IPS`.
- **Phản hồi (200)**: Dữ liệu dạng text `Content-Type: text/plain; version=0.0.4`.

---

### 3.2. Authentication & 2FA (`/api/auth`)

#### `POST /api/auth/register`

- **Mô tả**: Đăng ký tài khoản người dùng mới. Hệ thống sẽ tạo tài khoản và gửi mã xác thực 6 số qua email.
- **Quyền hạn**: `Public` (Áp dụng `authRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "username": "nguyenvana",
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Phản hồi (201)**:
  ```json
  {
    "status": "success",
    "code": 201,
    "message": "Đăng ký thành công, vui lòng kiểm tra mã xác thực trong email của bạn",
    "data": { "email": "user@example.com" }
  }
  ```

#### `POST /api/auth/login`

- **Mô tả**: Đăng nhập bằng Email và Password. Nếu tài khoản kích hoạt 2FA, API trả về `challengeToken` để tiếp tục xác thực 2FA. Nếu không có 2FA, server trả về thông tin user và tự động set cookie `accessToken`, `refreshToken`.
- **Quyền hạn**: `Public` (Áp dụng `authRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Phản hồi (200 - Thành công không 2FA)**:
  ```json
  {
    "status": "success",
    "code": 200,
    "message": "Đăng nhập thành công",
    "data": {
      "user": {
        "_id": "65df8a76b91234567890abcd",
        "username": "nguyenvana",
        "email": "user@example.com",
        "role": "user"
      }
    }
  }
  ```
- **Phản hồi (200 - Yêu cầu 2FA)**:
  ```json
  {
    "status": "success",
    "code": 200,
    "message": "Yêu cầu mã xác thực 2FA",
    "data": {
      "twoFactorRequired": true,
      "challengeToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### `POST /api/auth/2fa/verify-login`

- **Mô tả**: Hoàn tất đăng nhập bước 2 bằng mã OTP 6 số gửi qua email.
- **Quyền hạn**: `Public` (Áp dụng `authRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "challengeToken": "eyJhbGciOiJIUzI1Ni...",
    "code": "123456"
  }
  ```
- **Phản hồi (200)**: Trả về thông tin user và set cookie access/refresh token.

#### `POST /api/auth/2fa/resend-login-code`

- **Mô tả**: Gửi lại mã OTP xác thực 2FA khi đăng nhập.
- **Quyền hạn**: `Public` (Áp dụng `authRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "challengeToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```
- **Phản hồi (200)**: Gửi lại mã OTP thành công.

#### `POST /api/auth/send-verification-code`

- **Mô tả**: Gửi lại mã xác thực kích hoạt tài khoản email.
- **Quyền hạn**: `Public` (Áp dụng `authRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "email": "user@example.com"
  }
  ```

#### `POST /api/auth/verify-code`

- **Mô tả**: Xác thực email kích hoạt tài khoản bằng mã OTP 6 số.
- **Quyền hạn**: `Public` (Áp dụng `authRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "email": "user@example.com",
    "code": "123456"
  }
  ```
- **Phản hồi (200)**: Tài khoản được kích hoạt thành công.

#### `POST /api/auth/forgot-password`

- **Mô tả**: Yêu cầu cấp mã OTP đặt lại mật khẩu gửi về email.
- **Quyền hạn**: `Public` (Áp dụng `passwordResetRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "email": "user@example.com"
  }
  ```

#### `POST /api/auth/reset-password`

- **Mô tả**: Đặt lại mật khẩu mới cùng mã xác thực OTP 6 số.
- **Quyền hạn**: `Public` (Áp dụng `passwordResetRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "email": "user@example.com",
    "code": "123456",
    "newPassword": "NewPassword123!"
  }
  ```

#### `POST /api/auth/refresh-token`

- **Mô tả**: Cấp mới `accessToken` dựa trên `refreshToken` hợp lệ trong Cookie.
- **Quyền hạn**: `Public` (Yêu cầu cookie `refreshToken`)
- **Phản hồi (200)**: Token mới được ghi đè vào cookie `accessToken`.

#### `POST /api/auth/logout`

- **Mô tả**: Đăng xuất, vô hiệu hoá refresh token và xoá toàn bộ cookies xác thực.
- **Quyền hạn**: `Public`

#### `POST /api/auth/change-password`

- **Mô tả**: Đổi mật khẩu cho người dùng hiện tại đang đăng nhập.
- **Quyền hạn**: `User` (Đã đăng nhập)
- **Request Body (JSON)**:
  ```json
  {
    "oldPassword": "Password123!",
    "newPassword": "NewPassword456!"
  }
  ```

#### `POST /api/auth/2fa/send-code`

- **Mô tả**: Gửi mã OTP xác nhận để bật (`enable`) hoặc tắt (`disable`) bảo mật 2 bước 2FA.
- **Quyền hạn**: `User` (Đã đăng nhập)
- **Request Body (JSON)**:
  ```json
  {
    "action": "enable" // hoặc "disable"
  }
  ```

#### `POST /api/auth/2fa/confirm`

- **Mô tả**: Xác nhận mã OTP để hoàn tất bật/tắt 2FA.
- **Quyền hạn**: `User` (Đã đăng nhập)
- **Request Body (JSON)**:
  ```json
  {
    "action": "enable",
    "code": "123456"
  }
  ```

---

### 3.3. Users & Addresses (`/api/users`)

#### `POST /api/users/upload-avatar`

- **Mô tả**: Tải ảnh đại diện người dùng lên máy chủ (lưu trữ Cloudinary).
- **Quyền hạn**: `User`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `avatar` (File ảnh: jpg, jpeg, png, webp; tối đa 5MB; kiểm tra magic bytes signature).
- **Phản hồi (200)**: Trả về URL ảnh vừa upload.

#### `DELETE /api/users/avatar`

- **Mô tả**: Xoá ảnh đại diện hiện tại (đặt về null/mặc định).
- **Quyền hạn**: `User`
- **Phản hồi (200)**: Trả về thông tin user đã cập nhật avatar = null.

#### `GET /api/users/profile` / `GET /api/users/me`

- **Mô tả**: Lấy thông tin hồ sơ của người dùng hiện tại (`/me` là alias).
- **Quyền hạn**: `User`
- **Phản hồi (200)**:
  ```json
  {
    "status": "success",
    "code": 200,
    "data": {
      "_id": "65df8a76b91234567890abcd",
      "username": "nguyenvana",
      "email": "user@example.com",
      "role": "user",
      "avatar": "https://res.cloudinary.com/.../avatar.png",
      "fullName": "Nguyễn Văn A",
      "phone": "0987654321",
      "gender": "male",
      "dateOfBirth": "1995-05-15T00:00:00.000Z",
      "isVerifiedEmail": true,
      "isTwoFactorEnabled": false
    }
  }
  ```

#### `PUT /api/users/profile` / `PUT /api/users/me` & `PATCH`

- **Mô tả**: Cập nhật thông tin hồ sơ người dùng (hỗ trợ PUT và PATCH, alias `/me`).
- **Quyền hạn**: `User`
- **Request Body (JSON)**:
  ```json
  {
    "username": "nguyen_van_a_updated",
    "email": "new_email@example.com",
    "avatar": "https://res.cloudinary.com/.../avatar.png",
    "fullName": "Nguyễn Văn A",
    "phone": "0987654321",
    "gender": "male",
    "dateOfBirth": "1995-05-15"
  }
  ```

#### `GET /api/users/profile/stats` / `GET /api/users/me/stats`

- **Mô tả**: Lấy dữ liệu thống kê tổng quan của profile (số đơn hàng, đơn chờ xử lý, số voucher đã lưu, số sản phẩm yêu thích, số địa chỉ).
- **Quyền hạn**: `User`
- **Phản hồi (200)**:
  ```json
  {
    "status": "success",
    "code": 200,
    "data": {
      "orders": { "total": 12, "pending": 2 },
      "wishlist": { "total": 5 },
      "vouchers": { "saved": 3 },
      "notifications": { "unread": 4 },
      "addresses": { "total": 2 }
    }
  }
  ```

#### `DELETE /api/users/profile` / `DELETE /api/users/me`

- **Mô tả**: Người dùng tự xóa/hủy tài khoản cá nhân.
- **Quyền hạn**: `User`
- **Request Body (JSON - tuỳ chọn)**: `{ "password": "current_password" }` (cần cho tài khoản local).
- **Phản hồi (200)**: `{ "status": "success", "message": "Account deleted successfully" }`

#### `POST /api/users/addresses`

- **Mô tả**: Thêm địa chỉ nhận hàng mới cho người dùng.
- **Quyền hạn**: `User`
- **Request Body (JSON)**:
  ```json
  {
    "fullName": "Nguyễn Văn A",
    "phone": "0987654321",
    "address": "Số 123 Đường Cầu Giấy",
    "city": "Hà Nội",
    "district": "Quận Cầu Giấy",
    "ward": "Phường Dịch Vọng",
    "isDefault": true
  }
  ```

#### `GET /api/users/addresses/:addressId`

- **Mô tả**: Lấy thông tin chi tiết của 1 địa chỉ nhận hàng theo `addressId`.
- **Quyền hạn**: `User`
- **Path Param**: `addressId` (MongoDB ObjectId)

#### `PUT /api/users/addresses/:addressId`

- **Mô tả**: Cập nhật địa chỉ nhận hàng đã lưu.
- **Quyền hạn**: `User`
- **Path Param**: `addressId` (MongoDB ObjectId)
- **Request Body (JSON)**: Các trường tương tự thêm địa chỉ (không bắt buộc tất cả).

#### `DELETE /api/users/addresses/:addressId`

- **Mô tả**: Xoá địa chỉ nhận hàng.
- **Quyền hạn**: `User`
- **Path Param**: `addressId` (MongoDB ObjectId)

#### `GET /api/users/addresses`

- **Mô tả**: Lấy toàn bộ danh sách địa chỉ nhận hàng của người dùng.
- **Quyền hạn**: `User`

#### `PUT /api/users/addresses/:addressId/default`

- **Mô tả**: Đặt một địa chỉ làm địa chỉ giao hàng mặc định.
- **Quyền hạn**: `User`
- **Path Param**: `addressId` (MongoDB ObjectId)

#### `PUT /api/users/change-password`

- **Mô tả**: Đổi mật khẩu cá nhân (alias endpoint trong user router).
- **Quyền hạn**: `User`
- **Request Body (JSON)**: `{ "oldPassword": "...", "newPassword": "..." }`

#### `GET /api/users`

- **Mô tả**: Lấy danh sách tất cả người dùng trong hệ thống (có phân trang & lọc).
- **Quyền hạn**: `Admin`
- **Query Params**:
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
  - `role` (string: `'user'`, `'admin'`, `'seller'`)
  - `isVerifiedEmail` (boolean)
  - `search` (string)

#### `POST /api/users`

- **Mô tả**: Admin tạo trực tiếp tài khoản người dùng mới.
- **Quyền hạn**: `Admin`
- **Request Body (JSON)**:
  ```json
  {
    "username": "seller01",
    "email": "seller01@example.com",
    "password": "Password123!",
    "roles": "seller",
    "isVerifiedEmail": true
  }
  ```

#### `PUT /api/users`

- **Mô tả**: Admin cập nhật thông tin người dùng theo ID gửi trong body.
- **Quyền hạn**: `Admin`
- **Request Body (JSON)**: `{ "id": "...", "username": "...", "email": "...", "roles": "seller", "isVerifiedEmail": true }`

#### `PUT /api/users/:id`

- **Mô tả**: Admin cập nhật thông tin người dùng theo URL param.
- **Quyền hạn**: `Admin`
- **Path Param**: `id` (User ID)

#### `PUT /api/users/:id/role`

- **Mô tả**: Admin thay đổi vai trò quyền hạn (Role) của người dùng.
- **Quyền hạn**: `Admin`
- **Path Param**: `id` (User ID)
- **Request Body (JSON)**:
  ```json
  {
    "roles": "seller" // 'user' | 'seller' | 'admin'
  }
  ```

#### `PUT /api/users/:id/permissions`

- **Mô tả**: Admin cập nhật danh sách quyền trực tiếp của người dùng.
- **Quyền hạn**: `Admin`
- **Path Param**: `id` (User ID)
- **Request Body (JSON)**:
  ```json
  {
    "permissions": ["product:read", "order:update"]
  }
  ```

#### `GET /api/users/:id`

- **Mô tả**: Lấy thông tin chi tiết một người dùng cụ thể.
- **Quyền hạn**: `Admin`
- **Path Param**: `id` (User ID)

#### `DELETE /api/users/:id`

- **Mô tả**: Xoá tài khoản người dùng khỏi hệ thống.
- **Quyền hạn**: `Admin`
- **Path Param**: `id` (User ID)

---

### 3.4. Products & Variants (`/api/products`)

#### `GET /api/products`

- **Mô tả**: Lấy danh sách sản phẩm công khai với bộ lọc đa tiêu chí và phân trang.
- **Quyền hạn**: `Public`
- **Query Params**:
  - `page` (int, default: 1)
  - `limit` (int, default: 10, max: 100)
  - `category` (ObjectId hoặc Slug danh mục)
  - `brand` (string)
  - `shop` (Shop ObjectId)
  - `shopCategory` (Shop Category ObjectId)
  - `minPrice` (number), `maxPrice` (number)
  - `search` (từ khoá tìm kiếm)
  - `tags`, `colors`, `sizes`, `rating`
  - `sort` (`'price_asc'`, `'price_desc'`, `'newest'`, `'sold_desc'`, `'rating_desc'`)
  - `status` (`'draft'`, `'published'`, `'suspended'`, `'all'`)

#### `GET /api/products/search`

- **Mô tả**: Tìm kiếm sản phẩm nhanh (phục vụ Autocomplete dropdown).
- **Quyền hạn**: `Public`
- **Query Params**: `q` (từ khoá bắt buộc), `limit` (default: 10)

#### `GET /api/products/featured`

- **Mô tả**: Lấy danh sách sản phẩm nổi bật (`isFeatured: true`).
- **Quyền hạn**: `Public`
- **Query Params**: `limit` (default: 10)

#### `GET /api/products/new-arrivals`

- **Mô tả**: Lấy danh sách sản phẩm mới về (`isNewArrival: true`).
- **Quyền hạn**: `Public`

#### `GET /api/products/on-sale`

- **Mô tả**: Lấy danh sách các sản phẩm đang được giảm giá.
- **Quyền hạn**: `Public`

#### `GET /api/products/slug/:slug`

- **Mô tả**: Lấy thông tin chi tiết sản phẩm dựa theo đường dẫn thân thiện (SEO Slug).
- **Quyền hạn**: `Public`
- **Path Param**: `slug` (e.g. `ao-thun-nam-basic-cotton`)

#### `GET /api/products/category/:slug`

- **Mô tả**: Lấy danh sách sản phẩm thuộc về một danh mục theo Category Slug.
- **Quyền hạn**: `Public`
- **Path Param**: `slug` (Category Slug)
- **Query Params**: `page`, `limit`, `sort`

#### `GET /api/products/related/:id`

- **Mô tả**: Lấy các sản phẩm liên quan (cùng danh mục) với sản phẩm hiện tại.
- **Quyền hạn**: `Public`
- **Path Param**: `id` (Product ObjectId)

#### `GET /api/products/:id`

- **Mô tả**: Lấy thông tin chi tiết sản phẩm theo Product ObjectId.
- **Quyền hạn**: `Public`
- **Path Param**: `id` (Product ObjectId)

#### `POST /api/products`

- **Mô tả**: Tạo mới sản phẩm (thuộc Shop của Seller hoặc Admin).
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Content-Type**: `multipart/form-data` (hỗ trợ upload nhiều ảnh và parse JSON fields)
- **Form / JSON Fields**:
  - `name`: Tên sản phẩm (bắt buộc, 3-200 ký tự)
  - `description`: Mô tả chi tiết (bắt buộc, >= 10 ký tự)
  - `category`: Category ObjectId (bắt buộc)
  - `shopCategory`: Shop Category ObjectId (tùy chọn)
  - `brand`: Tên thương hiệu
  - `price`: `{ "currentPrice": 250000, "discountPrice": 200000, "currency": "VND" }` (bắt buộc)
  - `stock`: Số lượng tồn kho (int, >= 0)
  - `weight`: Khối lượng sản phẩm (gram, phục vụ tính phí ship)
  - `dimensions`: `{ "height": 10, "width": 20, "length": 30 }`
  - `variants`: Mảng các biến thể (SKU, tên, màu sắc, giá, kho)
  - `attributes`: Mảng thuộc tính bổ sung `[{ "name": "Chất liệu", "value": "Cotton" }]`
  - `tags`: Mảng từ khoá
  - `sizes`: Mảng kích cỡ `["S", "M", "L", "XL"]`
  - `status`: `'draft'` | `'published'` | `'suspended'`
  - `images`: Các file ảnh sản phẩm đính kèm

#### `PUT /api/products/seller/:id`

- **Mô tả**: Người bán cập nhật thông tin sản phẩm thuộc cửa hàng của mình.
- **Quyền hạn**: `Seller` (Chủ sở hữu Shop) hoặc `Admin`
- **Path Param**: `id` (Product ObjectId)
- **Content-Type**: `multipart/form-data`

#### `DELETE /api/products/seller/:id`

- **Mô tả**: Xoá mềm (soft-delete) sản phẩm thuộc shop của mình.
- **Quyền hạn**: `Seller` (Chủ sở hữu Shop) hoặc `Admin`
- **Path Param**: `id` (Product ObjectId)

#### `POST /api/products/seller/:id/variants`

- **Mô tả**: Thêm mới một biến thể (Variant) vào sản phẩm.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Path Param**: `id` (Product ObjectId)
- **Request Body (JSON / Multipart)**:
  ```json
  {
    "sku": "AT-DEN-XL",
    "name": "Màu đen size XL",
    "color": "Đen",
    "price": 270000,
    "stock": 50
  }
  ```

#### `PUT /api/products/seller/:id/variants/:variantId`

- **Mô tả**: Cập nhật thông tin của một biến thể sản phẩm.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Path Params**: `id` (Product ID), `variantId` (Variant ID)

#### `DELETE /api/products/seller/:id/variants/:variantId`

- **Mô tả**: Xoá một biến thể khỏi sản phẩm.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Path Params**: `id` (Product ID), `variantId` (Variant ID)

#### `DELETE /api/products/:id/permanent`

- **Mô tả**: Xoá vĩnh viễn sản phẩm khỏi cơ sở dữ liệu.
- **Quyền hạn**: `Admin` (Chỉ quản trị viên)
- **Path Param**: `id` (Product ObjectId)

---

### 3.5. Categories (`/api/categories`)

#### `GET /api/categories/active`

- **Mô tả**: Lấy danh sách các danh mục đang hoạt động (`isActive: true`).
- **Quyền hạn**: `Public`
- **Query Params**: `page`, `limit`, `parentCategory`

#### `GET /api/categories/tree`

- **Mô tả**: Lấy toàn bộ cây phân cấp danh mục (cha - con) đa cấp độ.
- **Quyền hạn**: `Public`
- **Phản hồi (200)**: Mảng lồng nhau các danh mục kèm danh sách `children`.

#### `GET /api/categories/slug/:slug`

- **Mô tả**: Lấy thông tin chi tiết danh mục theo Slug.
- **Quyền hạn**: `Public`
- **Path Param**: `slug` (Category Slug)

#### `POST /api/categories`

- **Mô tả**: Tạo mới danh mục sản phẩm.
- **Quyền hạn**: `Admin`
- **Request Body (JSON)**:
  ```json
  {
    "name": "Thời Trang Nam",
    "slug": "thoi-trang-nam",
    "description": "Quần áo thời trang nam cao cấp",
    "parentCategory": null,
    "images": ["https://res.cloudinary.com/.../cat.jpg"],
    "isActive": true
  }
  ```

#### `GET /api/categories`

- **Mô tả**: Lấy tất cả danh mục (kể cả chưa kích hoạt) kèm bộ lọc.
- **Quyền hạn**: `Admin`

#### `GET /api/categories/statistics`

- **Mô tả**: Thống kê số lượng sản phẩm theo từng danh mục.
- **Quyền hạn**: `Admin`

#### `GET /api/categories/:categoryId`

- **Mô tả**: Lấy thông tin chi tiết danh mục theo ID.
- **Quyền hạn**: `Admin`
- **Path Param**: `categoryId` (Category ObjectId)

#### `GET /api/categories/:categoryId/subcategories`

- **Mô tả**: Lấy danh sách các danh mục con trực thuộc một danh mục cha.
- **Quyền hạn**: `Admin`
- **Path Param**: `categoryId` (Category ObjectId)

#### `PUT /api/categories/:categoryId`

- **Mô tả**: Cập nhật thông tin danh mục.
- **Quyền hạn**: `Admin`
- **Path Param**: `categoryId` (Category ObjectId)

#### `DELETE /api/categories/:categoryId`

- **Mô tả**: Xoá danh mục.
- **Quyền hạn**: `Admin`
- **Path Param**: `categoryId` (Category ObjectId)

---

### 3.6. Shopping Cart (`/api/cart`)

_Lưu ý: Tất cả các route giỏ hàng đều yêu cầu người dùng đăng nhập (`verifyAccessToken`)._

#### `GET /api/cart`

- **Mô tả**: Lấy thông tin giỏ hàng hiện tại của người dùng (bao gồm danh sách sản phẩm, biến thể, giá, tổng tiền, tình trạng tồn kho).
- **Quyền hạn**: `User`

#### `GET /api/cart/count`

- **Mô tả**: Lấy tổng số lượng sản phẩm đang có trong giỏ hàng (hiển thị trên badge icon giỏ hàng).
- **Quyền hạn**: `User`
- **Phản hồi (200)**: `{ "status": "success", "data": { "count": 5 } }`

#### `POST /api/cart`

- **Mô tả**: Thêm sản phẩm hoặc biến thể vào giỏ hàng.
- **Quyền hạn**: `User`
- **Request Body (JSON)**:
  ```json
  {
    "productId": "65df8a76b91234567890abcd",
    "shopId": "65df8a76b91234567890abce",
    "variantId": "65df8a76b91234567890abcf",
    "modelId": null,
    "size": "L",
    "quantity": 2
  }
  ```

#### `PUT /api/cart/:itemId`

- **Mô tả**: Cập nhật số lượng của một sản phẩm trong giỏ hàng.
- **Quyền hạn**: `User`
- **Path Param**: `itemId` (ObjectId của item trong giỏ hàng)
- **Request Body (JSON)**:
  ```json
  {
    "quantity": 3
  }
  ```

#### `DELETE /api/cart/:itemId`

- **Mô tả**: Xoá một item ra khỏi giỏ hàng.
- **Quyền hạn**: `User`
- **Path Param**: `itemId` (ObjectId của item)

#### `DELETE /api/cart`

- **Mô tả**: Xoá toàn bộ các mặt hàng trong giỏ hàng (Clear cart).
- **Quyền hạn**: `User`

---

### 3.7. Orders & Fulfillment (`/api/orders`)

#### `POST /api/orders`

- **Mô tả**: Đặt hàng mới từ các mặt hàng trong giỏ hàng (Checkout). Hỗ trợ áp dụng Voucher sàn (Platform) và Voucher Shop.
- **Quyền hạn**: `User`
- **Request Body (JSON)**:
  ```json
  {
    "cartItemIds": ["65df8a76b91234567890ab11", "65df8a76b91234567890ab12"],
    "addressId": "65df8a76b91234567890abcd",
    "paymentMethod": "cod", // 'cod' | 'vnpay' | 'momo'
    "platformVoucher": "FREESHIP50K",
    "shopVouchers": [
      {
        "shopId": "65df8a76b91234567890abc3",
        "code": "SHOPDISCOUNT10"
      }
    ],
    "note": "Giao giờ hành chính giúp tôi"
  }
  ```
- **Phản hồi (201)**: Trả về thông tin đơn hàng đã tạo (`Order`).

#### `GET /api/orders`

- **Mô tả**: Lấy danh sách lịch sử đơn hàng của người dùng hiện tại.
- **Quyền hạn**: `User`
- **Query Params**: `page`, `limit`, `status` (`pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `returned`), `paymentStatus`

#### `GET /api/orders/:orderId`

- **Mô tả**: Xem chi tiết một đơn hàng cụ thể theo ID.
- **Quyền hạn**: `User` (Chủ đơn hàng) hoặc `Admin` / `Seller` liên quan
- **Path Param**: `orderId` (Order ObjectId)

#### `DELETE /api/orders/:orderId/cancel`

- **Mô tả**: Người mua huỷ đơn hàng (chỉ áp dụng khi đơn ở trạng thái `pending` hoặc `confirmed`).
- **Quyền hạn**: `User`
- **Path Param**: `orderId` (Order ObjectId)

#### `POST /api/orders/:orderId/confirm-delivery`

- **Mô tả**: Khách hàng xác nhận đã nhận được hàng thành công.
- **Quyền hạn**: `User`
- **Path Param**: `orderId` (Order ObjectId)

#### `GET /api/orders/all/list`

- **Mô tả**: Quản trị viên lấy danh sách toàn bộ đơn hàng trên toàn hệ thống kèm bộ lọc.
- **Quyền hạn**: `Admin`
- **Query Params**: `page`, `limit`, `status`, `paymentStatus`, `paymentMethod`, `userId`, `shop`

#### `GET /api/orders/seller/list`

- **Mô tả**: Lấy danh sách các đơn hàng có sản phẩm thuộc Shop của người bán.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Query Params**: `page`, `limit`, `status`, `paymentStatus`

#### `GET /api/orders/seller/statistics`

- **Mô tả**: Thống kê doanh thu, số lượng đơn hàng theo trạng thái dành cho Shop.
- **Quyền hạn**: `Seller` hoặc `Admin`

#### `PUT /api/orders/:orderId/status`

- **Mô tả**: Cập nhật trạng thái đơn hàng (Admin hoặc Seller có quyền).
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Path Param**: `orderId` (Order ObjectId)
- **Request Body (JSON)**:
  ```json
  {
    "status": "processing" // 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'
  }
  ```

#### `PUT /api/orders/seller/:orderId/status`

- **Mô tả**: Người bán cập nhật trạng thái đơn hàng thuộc Shop mình quản lý.
- **Quyền hạn**: `Seller` (Chủ shop) hoặc `Admin`
- **Path Param**: `orderId` (Order ObjectId)
- **Request Body (JSON)**: `{ "status": "shipped" }`

#### `GET /api/orders/statistics/overview`

- **Mô tả**: Xem biểu đồ tổng hợp và số liệu phân tích đơn hàng toàn sàn.
- **Quyền hạn**: `Admin`

---

### 3.8. Payments & VNPay Gateway (`/api/payment`)

#### `POST /api/payment`

- **Mô tả**: Khởi tạo phiên thanh toán trực tuyến qua cổng VNPay cho một đơn hàng. Trả về URL cổng thanh toán VNPay để redirect người dùng.
- **Quyền hạn**: `User`
- **Request Body (JSON)**:
  ```json
  {
    "orderId": "65df8a76b91234567890abcd"
  }
  ```
- **Phản hồi (200)**:
  ```json
  {
    "status": "success",
    "code": 200,
    "message": "Tạo URL thanh toán thành công",
    "data": {
      "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=..."
    }
  }
  ```

#### `GET /api/payment/order/:orderId`

- **Mô tả**: Lấy thông tin chi tiết giao dịch thanh toán của một đơn hàng.
- **Quyền hạn**: `User`
- **Path Param**: `orderId` (Order ObjectId)

#### `GET /api/payment/vnpay-return`

- **Mô tả**: URL redirect khách hàng quay trở lại trang web sau khi thanh toán tại VNPay. Kiểm tra checksum chữ ký số và cập nhật kết quả sơ bộ.
- **Quyền hạn**: `Public`

#### `GET /api/payment/vnpay-ipn`

- **Mô tả**: Server-to-Server IPN Callback từ VNPay để cập nhật trạng thái đơn hàng (`paid` / `failed`) bảo đảm tính bất biến và bảo mật.
- **Quyền hạn**: `Public` (Kiểm tra Hash Secret)

---

### 3.9. Banners (`/api/banners`)

#### `GET /api/banners`

- **Mô tả**: Lấy danh sách các banner quảng cáo đang hoạt động để hiển thị trang chủ.
- **Quyền hạn**: `Public`

#### `GET /api/banners/admin/all`

- **Mô tả**: Lấy toàn bộ banner (bao gồm các banner đã tắt/hết hạn).
- **Quyền hạn**: `Admin`

#### `GET /api/banners/:id`

- **Mô tả**: Lấy thông tin một banner theo ID.
- **Quyền hạn**: `Public`
- **Path Param**: `id` (Banner ObjectId)

#### `POST /api/banners`

- **Mô tả**: Tạo mới banner quảng cáo.
- **Quyền hạn**: `Admin`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `title` (string, bắt buộc)
  - `subtitle` (string, bắt buộc)
  - `link` (string)
  - `theme` (`'light'` | `'dark'`)
  - `order` (int)
  - `isActive` (boolean)
  - `image` (File ảnh đính kèm)

#### `PUT /api/banners/:id`

- **Mô tả**: Cập nhật thông tin banner.
- **Quyền hạn**: `Admin`
- **Path Param**: `id` (Banner ObjectId)
- **Content-Type**: `multipart/form-data`

#### `DELETE /api/banners/:id`

- **Mô tả**: Xoá banner.
- **Quyền hạn**: `Admin`
- **Path Param**: `id` (Banner ObjectId)

---

### 3.10. Chatbot & AI Shopping Assistant (`/api/chatbot`)

#### `POST /api/chatbot/message`

- **Mô tả**: Gửi tin nhắn đến Trợ lý ảo AI Mua Sắm (trả về kết quả JSON đầy đủ sau khi hoàn tất chuỗi Agent / Tool Call).
- **Quyền hạn**: `Public` (Áp dụng `chatbotRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "message": "Gợi ý cho tôi áo thun nam basic màu trắng dưới 300k",
    "sessionId": "b484594c-47b2-4d2b-bbd7-133e9d8e578c" // UUID v4 tùy chọn, tự sinh nếu rỗng
  }
  ```
- **Phản hồi (200)**:
  ```json
  {
    "status": "success",
    "data": {
      "reply": "Dưới đây là một số mẫu áo thun nam basic trắng phù hợp...",
      "products": [ ... ],
      "sessionId": "b484594c-47b2-4d2b-bbd7-133e9d8e578c"
    }
  }
  ```

#### `POST /api/chatbot/stream`

- **Mô tả**: Stream câu trả lời của AI theo thời gian thực qua Server-Sent Events (SSE). Bắn từng token văn bản và trạng thái tool calling.
- **Quyền hạn**: `Public` (Áp dụng `chatbotRateLimiter`)
- **Headers Phản hồi**: `Content-Type: text/event-stream`, `Cache-Control: no-cache`
- **Request Body (JSON)**:
  ```json
  {
    "message": "Tư vấn chọn size áo cho người cao 1m75 nặng 70kg",
    "sessionId": "b484594c-47b2-4d2b-bbd7-133e9d8e578c"
  }
  ```

#### `GET /api/chatbot/history/:sessionId`

- **Mô tả**: Lấy lịch sử hội thoại của một phiên chat với bot theo `sessionId`.
- **Quyền hạn**: `Public`
- **Path Param**: `sessionId` (UUID v4)

#### `DELETE /api/chatbot/session/:sessionId`

- **Mô tả**: Xoá lịch sử hội thoại của phiên chat hiện tại.
- **Quyền hạn**: `Public`
- **Path Param**: `sessionId` (UUID v4)

#### `GET /api/chatbot/suggestions`

- **Mô tả**: Lấy các câu hỏi gợi ý nhanh (Quick prompt chips) cho người dùng mới.
- **Quyền hạn**: `Public`

#### `GET /api/chatbot/status`

- **Mô tả**: Kiểm tra trạng thái hoạt động và cấu hình model của AI Shopping Assistant (Canary release flags).
- **Quyền hạn**: `Public`

#### `POST /api/chatbot/feedback`

- **Mô tả**: Gửi phản hồi đánh giá chất lượng câu trả lời của AI (Like / Dislike).
- **Quyền hạn**: `Public` (Áp dụng `chatbotRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "sessionId": "b484594c-47b2-4d2b-bbd7-133e9d8e578c",
    "messageId": "msg-65df8a76b91234567890abcd",
    "rating": "up", // 'up' | 'down'
    "comment": "Gợi ý rất chuẩn size và giá tốt"
  }
  ```

#### `GET /api/chatbot/admin/sessions`

- **Mô tả**: Quản trị viên xem danh sách các phiên chat của người dùng trên hệ thống.
- **Quyền hạn**: `Admin`
- **Query Params**: `page`, `limit`

#### `DELETE /api/chatbot/admin/sessions/:sessionId`

- **Mô tả**: Xoá vĩnh viễn dữ liệu hội thoại của một phiên chat phục vụ tuân thủ GDPR / Quyền riêng tư.
- **Quyền hạn**: `Admin`
- **Path Param**: `sessionId` (UUID v4)

---

### 3.11. Shops & Multi-Vendor (`/api/shops`)

#### `GET /api/shops`

- **Mô tả**: Lấy danh sách các cửa hàng đang hoạt động công khai.
- **Quyền hạn**: `Public`

#### `GET /api/shops/admin/all`

- **Mô tả**: Lấy danh sách toàn bộ các shop (bao gồm chờ duyệt, đang khoá, bị từ chối).
- **Quyền hạn**: `Admin`

#### `PUT /api/shops/admin/:shopId/status`

- **Mô tả**: Admin phê duyệt hoặc thay đổi trạng thái hoạt động của Shop.
- **Quyền hạn**: `Admin`
- **Path Param**: `shopId` (Shop ObjectId)
- **Request Body (JSON)**:
  ```json
  {
    "status": "active" // 'active' | 'inactive' | 'suspended' | 'rejected'
  }
  ```

#### `POST /api/shops/register`

- **Mô tả**: Đăng ký mở cửa hàng mới (Trở thành Seller trên sàn).
- **Quyền hạn**: `User` (Đã đăng nhập)
- **Request Body (JSON)**:
  ```json
  {
    "name": "Thời Trang Nam Pro",
    "description": "Chuyên đồ nam công sở và dạo phố",
    "logo": "https://res.cloudinary.com/.../logo.jpg",
    "banner": "https://res.cloudinary.com/.../banner.jpg",
    "pickupAddress": {
      "fullName": "Nguyễn Văn Chủ Shop",
      "phone": "0912345678",
      "address": "Tầng 2, 456 Hoàng Hoa Thám",
      "city": "Hà Nội",
      "district": "Quận Ba Đình",
      "ward": "Phường Vĩnh Phúc"
    }
  }
  ```

#### `POST /api/shops/upload-register-image`

- **Mô tả**: Upload logo hoặc ảnh bìa trong quá trình đăng ký shop.
- **Quyền hạn**: `User`
- **Content-Type**: `multipart/form-data` (Field: `image` hoặc `file`)

#### `GET /api/shops/statistics`

- **Mô tả**: Lấy thống kê tổng quan của cửa hàng (doanh thu, đơn hàng, sản phẩm, lượt theo dõi) phục vụ Seller Dashboard.
- **Quyền hạn**: `Seller` hoặc `Admin`

#### `GET /api/shops/following`

- **Mô tả**: Lấy danh sách các cửa hàng mà người dùng hiện tại đang bấm theo dõi.
- **Quyền hạn**: `User`

#### `GET /api/shops/me` & `GET /api/shops/my`

- **Mô tả**: Lấy thông tin chi tiết Shop của người bán hiện tại.
- **Quyền hạn**: `Seller` hoặc `Admin`

#### `PUT /api/shops` & `PUT /api/shops/my`

- **Mô tả**: Cập nhật thông tin hồ sơ Shop của người bán.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Request Body (JSON)**: `{ "name": "...", "description": "...", "pickupAddress": { ... }, "isActive": true }`

#### `POST /api/shops/upload-image`

- **Mô tả**: Tải ảnh logo hoặc banner cho Shop.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Content-Type**: `multipart/form-data`

#### `POST /api/shops/upload-logo`

- **Mô tả**: Tải ảnh Logo riêng biệt cho Shop.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Content-Type**: `multipart/form-data`

#### `POST /api/shops/upload-banner`

- **Mô tả**: Tải ảnh Banner riêng biệt cho Shop.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Content-Type**: `multipart/form-data`

#### `POST /api/shops/:shopId/follow`

- **Mô tả**: Bấm theo dõi (Follow) một Shop.
- **Quyền hạn**: `User`
- **Path Param**: `shopId` (Shop ObjectId)

#### `DELETE /api/shops/:shopId/follow`

- **Mô tả**: Bỏ theo dõi (Unfollow) Shop.
- **Quyền hạn**: `User`
- **Path Param**: `shopId` (Shop ObjectId)

#### `GET /api/shops/slug/:slug`

- **Mô tả**: Xem thông tin công khai của Shop theo Slug.
- **Quyền hạn**: `Public`
- **Path Param**: `slug` (Shop Slug)

#### `GET /api/shops/:shopId`

- **Mô tả**: Xem thông tin công khai của Shop theo ID.
- **Quyền hạn**: `Public`
- **Path Param**: `shopId` (Shop ObjectId)

---

### 3.12. Shop Categories (`/api/shop-categories`)

#### `GET /api/shop-categories/my`

- **Mô tả**: Người bán lấy danh mục nội bộ do chính Shop tạo ra.
- **Quyền hạn**: `Seller` hoặc `Admin`

#### `POST /api/shop-categories`

- **Mô tả**: Tạo mới danh mục nội bộ của Shop.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Request Body (JSON)**:
  ```json
  {
    "name": "Áo Sơ Mi Mùa Hè",
    "description": "Bộ sưu tập áo sơ mi thoáng mát",
    "image": "https://...",
    "displayOrder": 1,
    "isActive": true
  }
  ```

#### `PUT /api/shop-categories/:categoryId`

- **Mô tả**: Cập nhật danh mục nội bộ của Shop.
- **Quyền hạn**: `Seller` (Chủ shop) hoặc `Admin`
- **Path Param**: `categoryId` (Shop Category ObjectId)

#### `DELETE /api/shop-categories/:categoryId`

- **Mô tả**: Xoá danh mục nội bộ của Shop.
- **Quyền hạn**: `Seller` (Chủ shop) hoặc `Admin`
- **Path Param**: `categoryId` (Shop Category ObjectId)

#### `GET /api/shop-categories/:shopId`

- **Mô tả**: Khách hàng xem danh sách các danh mục phân loại riêng của một Shop cụ thể.
- **Quyền hạn**: `Public`
- **Path Param**: `shopId` (Shop ObjectId)

---

### 3.13. Vouchers & Discounts (`/api/vouchers`)

#### `GET /api/vouchers/platform`

- **Mô tả**: Lấy danh sách các mã giảm giá công khai của toàn bộ sàn giao dịch.
- **Quyền hạn**: `Public`

#### `GET /api/vouchers/shop/:shopId`

- **Mô tả**: Lấy các mã giảm giá công khai do một Shop cụ thể phát hành.
- **Quyền hạn**: `Public`
- **Path Param**: `shopId` (Shop ObjectId)

#### `GET /api/vouchers/available`

- **Mô tả**: Lấy tất cả voucher khả dụng mà người dùng hiện tại có thể áp dụng.
- **Quyền hạn**: `User`

#### `POST /api/vouchers/apply`

- **Mô tả**: Kiểm tra tính hợp lệ và tính toán số tiền chiết khấu của Voucher đối với đơn hàng hiện tại.
- **Quyền hạn**: `User`
- **Request Body (JSON)**:
  ```json
  {
    "code": "SALE20",
    "orderAmount": 500000
  }
  ```

#### `GET /api/vouchers`

- **Mô tả**: Lấy toàn bộ danh sách voucher trong hệ thống kèm bộ lọc.
- **Quyền hạn**: `Admin`
- **Query Params**: `page`, `limit`, `scope` (`'shop'`, `'platform'`, `'all'`), `isActive`

#### `GET /api/vouchers/statistics`

- **Mô tả**: Thống kê mức độ sử dụng và hiệu quả của các chiến dịch khuyến mãi.
- **Quyền hạn**: `Admin`

#### `GET /api/vouchers/:id`

- **Mô tả**: Lấy chi tiết thông tin một mã voucher theo ID.
- **Quyền hạn**: `User`
- **Path Param**: `id` (Voucher ObjectId)

#### `POST /api/vouchers`

- **Mô tả**: Tạo mới Voucher khuyến mãi.
- **Quyền hạn**: `Seller` (Tạo voucher cho shop mình) hoặc `Admin` (Tạo voucher toàn sàn)
- **Request Body (JSON)**:
  ```json
  {
    "code": "SUMMER2026",
    "name": "Giảm giá mùa hè",
    "description": "Giảm 15% cho đơn từ 200k",
    "type": "percentage", // 'fixed_amount' | 'percentage'
    "value": 15,
    "maxValue": 50000,
    "scope": "shop", // 'shop' | 'platform'
    "shopId": "65df8a76b91234567890abcd", // Bắt buộc nếu scope = shop
    "minOrderValue": 200000,
    "usageLimit": 500,
    "usageLimitPerUser": 1,
    "startDate": "2026-06-01T00:00:00.000Z",
    "endDate": "2026-08-31T23:59:59.000Z",
    "isActive": true
  }
  ```

#### `PUT /api/vouchers/:id`

- **Mô tả**: Cập nhật thông tin voucher.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Path Param**: `id` (Voucher ObjectId)

#### `DELETE /api/vouchers/:id`

- **Mô tả**: Xoá mềm (soft-delete) voucher.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Path Param**: `id` (Voucher ObjectId)

#### `DELETE /api/vouchers/:id/permanent`

- **Mô tả**: Xoá vĩnh viễn voucher khỏi database.
- **Quyền hạn**: `Admin`
- **Path Param**: `id` (Voucher ObjectId)

---

### 3.14. P2P Chat (`/api/chat`)

_Tất cả các route chat yêu cầu người dùng đăng nhập (`verifyAccessToken`)._

#### `POST /api/chat/start`

- **Mô tả**: Bắt đầu cuộc trò chuyện mới hoặc tìm hội thoại đã có với một Shop hoặc người dùng khác.
- **Quyền hạn**: `User`
- **Request Body (JSON)**:
  ```json
  {
    "shopId": "65df8a76b91234567890abc3",
    "productId": "65df8a76b91234567890abcd", // Tùy chọn nếu chat từ trang sản phẩm
    "message": "Xin chào, shop còn hàng size XL màu trắng không?"
  }
  ```

#### `POST /api/chat/message`

- **Mô tả**: Gửi tin nhắn văn bản trong cuộc hội thoại.
- **Quyền hạn**: `User`
- **Request Body (JSON)**:
  ```json
  {
    "conversationId": "65df8a76b91234567890abe1",
    "content": "Sản phẩm này bảo hành bao lâu vậy shop?",
    "messageType": "text", // 'text' | 'image' | 'file' | 'product'
    "productRef": "65df8a76b91234567890abcd"
  }
  ```

#### `POST /api/chat/message/media`

- **Mô tả**: Gửi tin nhắn đính kèm hình ảnh hoặc tài liệu (tối đa 5 files, dung lượng <= 10MB/file: ảnh, PDF, word, zip).
- **Quyền hạn**: `User`
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `conversationId`: ID cuộc hội thoại
  - `content`: Lời nhắn kèm theo
  - `files`: Danh sách file đính kèm

#### `GET /api/chat/conversations`

- **Mô tả**: Lấy danh sách tất cả các cuộc hội thoại của người dùng hiện tại.
- **Quyền hạn**: `User`

#### `GET /api/chat/messages/:conversationId`

- **Mô tả**: Lấy lịch sử tin nhắn trong một cuộc hội thoại cụ thể.
- **Quyền hạn**: `User` (Thành viên tham gia cuộc hội thoại)
- **Path Param**: `conversationId` (Conversation ObjectId)

#### `PUT /api/chat/conversations/:conversationId/read`

- **Mô tả**: Đánh dấu đã đọc toàn bộ tin nhắn trong cuộc hội thoại.
- **Quyền hạn**: `User`
- **Path Param**: `conversationId` (Conversation ObjectId)

---

### 3.15. Wishlist (`/api/wishlist`)

_Tất cả route yêu cầu người dùng đăng nhập (`verifyAccessToken`)._

#### `GET /api/wishlist`

- **Mô tả**: Lấy danh sách toàn bộ sản phẩm yêu thích đã lưu của người dùng.
- **Quyền hạn**: `User`

#### `GET /api/wishlist/count`

- **Mô tả**: Lấy số lượng sản phẩm trong danh sách yêu thích.
- **Quyền hạn**: `User`
- **Phản hồi (200)**: `{ "count": 8 }`

#### `GET /api/wishlist/check/:productId`

- **Mô tả**: Kiểm tra xem một sản phẩm cụ thể đã nằm trong danh sách yêu thích chưa.
- **Quyền hạn**: `User`
- **Path Param**: `productId` (Product ObjectId)

#### `POST /api/wishlist/check-multiple`

- **Mô tả**: Kiểm tra hàng loạt nhiều sản phẩm xem đã được yêu thích hay chưa.
- **Quyền hạn**: `User`
- **Request Body (JSON)**:
  ```json
  {
    "productIds": ["65df8a76b91234567890ab01", "65df8a76b91234567890ab02"]
  }
  ```

#### `POST /api/wishlist/:productId`

- **Mô tả**: Thêm sản phẩm vào danh sách yêu thích.
- **Quyền hạn**: `User`
- **Path Param**: `productId` (Product ObjectId)

#### `DELETE /api/wishlist/:productId`

- **Mô tả**: Bỏ một sản phẩm ra khỏi danh sách yêu thích.
- **Quyền hạn**: `User`
- **Path Param**: `productId` (Product ObjectId)

#### `DELETE /api/wishlist`

- **Mô tả**: Xoá sạch toàn bộ danh sách yêu thích.
- **Quyền hạn**: `User`

---

### 3.16. Search & Discovery (`/api/search`)

#### `GET /api/search`

- **Mô tả**: Tìm kiếm nâng cao kết hợp đa tiêu chí trên toàn bộ danh mục sản phẩm.
- **Quyền hạn**: `Public`
- **Query Params**:
  - `q`: Từ khoá tìm kiếm
  - `category`: ID danh mục
  - `brand`: Tên thương hiệu
  - `minPrice`, `maxPrice`: Khoảng giá lọc
  - `rating`: Lọc theo số sao đánh giá (tối thiểu)
  - `page`, `limit`

#### `GET /api/search/suggestions`

- **Mô tả**: Lấy gợi ý từ khoá tự động hoàn thành khi người dùng gõ tìm kiếm.
- **Quyền hạn**: `Public`
- **Query Param**: `q`

#### `GET /api/search/trending`

- **Mô tả**: Lấy danh sách các từ khoá đang có lượng tìm kiếm tăng vọt (Trending Search).
- **Quyền hạn**: `Public`

#### `GET /api/search/hot-keywords`

- **Mô tả**: Lấy các từ khoá tìm kiếm nổi bật/khuyến mãi (Hot Keywords) hiển thị dạng tag chips.
- **Quyền hạn**: `Public`

---

### 3.17. Flash Sale (`/api/flash-sale`)

#### `GET /api/flash-sale`

- **Mô tả**: Lấy danh sách các sản phẩm đang tham gia chương trình Flash Sale trong khung giờ hiện tại.
- **Quyền hạn**: `Public`

#### `GET /api/flash-sale/schedule`

- **Mô tả**: Lấy lịch trình các khung giờ Flash Sale sắp tới trong ngày.
- **Quyền hạn**: `Public`

#### `GET /api/flash-sale/slot/:timeSlot`

- **Mô tả**: Lấy danh sách sản phẩm theo một khung giờ cụ thể.
- **Quyền hạn**: `Public`
- **Path Param**: `timeSlot` (e.g. `12:00`, `16:00`, `20:00`)

#### `GET /api/flash-sale/stats`

- **Mô tả**: Thống kê số lượng bán và tỉ lệ chốt đơn của các đợt Flash Sale.
- **Quyền hạn**: `Admin`

#### `POST /api/flash-sale/:productId`

- **Mô tả**: Đăng ký đưa một sản phẩm vào chương trình Flash Sale.
- **Quyền hạn**: `Admin` hoặc `Seller`
- **Path Param**: `productId` (Product ObjectId)
- **Request Body (JSON)**:
  ```json
  {
    "discountPercentage": 35,
    "stockForSale": 100,
    "startTime": "2026-09-12T12:00:00.000Z",
    "endTime": "2026-09-12T14:00:00.000Z"
  }
  ```

#### `DELETE /api/flash-sale/:productId`

- **Mô tả**: Huỷ sản phẩm khỏi chương trình Flash Sale.
- **Quyền hạn**: `Admin` hoặc `Seller`
- **Path Param**: `productId` (Product ObjectId)

---

### 3.18. Recommendations Engine (`/api/recommendations`)

_Tất cả route hỗ trợ `optionalAuth`: nếu người dùng đã đăng nhập, hệ thống sẽ cá nhân hoá chính xác theo lịch sử xem/mua hàng; nếu là khách vãng lai, hệ thống gợi ý theo độ thịnh hành._

#### `GET /api/recommendations/for-you`

- **Mô tả**: Bảng tin sản phẩm gợi ý cá nhân hoá dành riêng cho người dùng ("Dành cho bạn").
- **Quyền hạn**: `Public` (Cá nhân hoá nếu có token)

#### `GET /api/recommendations/homepage`

- **Mô tả**: Gợi ý các khối sản phẩm thịnh hành trên Trang chủ.
- **Quyền hạn**: `Public`

#### `GET /api/recommendations/recently-viewed`

- **Mô tả**: Lấy danh sách các sản phẩm người dùng vừa mới xem gần đây.
- **Quyền hạn**: `Public` (Yêu cầu đăng nhập để lưu trữ dài hạn)

#### `POST /api/recommendations/track-view/:productId`

- **Mô tả**: Bắn sự kiện ghi nhận người dùng đã xem sản phẩm (để huấn luyện mô hình gợi ý).
- **Quyền hạn**: `Public` (Có ghi nhận user nếu đã đăng nhập)
- **Path Param**: `productId` (Product ObjectId)

#### `GET /api/recommendations/fbt/:productId`

- **Mô tả**: Lấy danh sách sản phẩm "Thường được mua cùng nhau" (Frequently Bought Together).
- **Quyền hạn**: `Public`
- **Path Param**: `productId` (Product ObjectId)

#### `GET /api/recommendations/similar/:productId`

- **Mô tả**: Lấy danh sách sản phẩm có đặc tính và kiểu dáng tương tự.
- **Quyền hạn**: `Public`
- **Path Param**: `productId` (Product ObjectId)

#### `GET /api/recommendations/category/:categoryId`

- **Mô tả**: Lấy các sản phẩm được đề xuất hàng đầu trong một danh mục cụ thể.
- **Quyền hạn**: `Public`
- **Path Param**: `categoryId` (Category ObjectId)

---

### 3.19. Permissions & RBAC (`/api/permissions`)

#### `GET /api/permissions`

- **Mô tả**: Lấy danh sách toàn bộ các quyền hạn (Permissions) có trong hệ thống.
- **Quyền hạn**: `Public`

#### `GET /api/permissions/roles`

- **Mô tả**: Lấy ma trận quyền hạn mặc định gán cho từng Role (`user`, `seller`, `admin`).
- **Quyền hạn**: `Public`

#### `GET /api/permissions/me`

- **Mô tả**: Lấy danh sách quyền hạn hiệu lực thực tế của người dùng hiện tại (kết hợp Role và quyền được cấp riêng).
- **Quyền hạn**: `User` (Đã đăng nhập)

#### `GET /api/permissions/audit`

- **Mô tả**: Xem nhật ký kiểm toán (Audit logs) ghi nhận các lần cấp/thu hồi quyền trong hệ thống.
- **Quyền hạn**: `Admin` (Yêu cầu quyền `admin:access`)
- **Query Params**: `page`, `limit`, `userId`, `action` (`'grant'`, `'revoke'`, `'bulk_update'`)

#### `GET /api/permissions/user/:userId`

- **Mô tả**: Xem danh sách quyền hạn riêng của một người dùng cụ thể.
- **Quyền hạn**: `Admin`
- **Path Param**: `userId` (User ObjectId)

#### `PUT /api/permissions/user/:userId`

- **Mô tả**: Cập nhật toàn bộ mảng quyền hạn cho một người dùng.
- **Quyền hạn**: `Admin`
- **Path Param**: `userId` (User ObjectId)
- **Request Body (JSON)**:
  ```json
  {
    "permissions": ["product:create", "product:update", "order:view"]
  }
  ```

#### `POST /api/permissions/user/:userId/grant`

- **Mô tả**: Cấp thêm 1 quyền cụ thể cho người dùng.
- **Quyền hạn**: `Admin`
- **Path Param**: `userId` (User ObjectId)
- **Request Body (JSON)**: `{ "permission": "shop:manage" }`

#### `POST /api/permissions/user/:userId/revoke`

- **Mô tả**: Thu hồi 1 quyền cụ thể khỏi người dùng.
- **Quyền hạn**: `Admin`
- **Path Param**: `userId` (User ObjectId)
- **Request Body (JSON)**: `{ "permission": "shop:manage" }`

---

### 3.20. Settings (`/api/settings`)

_Tất cả route Settings yêu cầu quyền `Admin`._

#### `GET /api/settings`

- **Mô tả**: Lấy toàn bộ thông số cấu hình hệ thống (cửa hàng, thông báo, giao diện, thanh toán, chính sách).
- **Quyền hạn**: `Admin`

#### `PUT /api/settings`

- **Mô tả**: Cập nhật thông số cấu hình hệ thống (Partial update).
- **Quyền hạn**: `Admin`
- **Request Body (JSON)**:
  ```json
  {
    "store": { "storeName": "My E-Commerce", "contactEmail": "support@ecommerce.local" },
    "notifications": { "emailAlerts": true },
    "display": { "currency": "VND", "itemsPerPage": 20 },
    "business": { "taxPercentage": 10 }
  }
  ```

#### `POST /api/settings/reset`

- **Mô tả**: Khôi phục cấu hình hệ thống về trạng thái mặc định ban đầu.
- **Quyền hạn**: `Admin`

#### `GET /api/settings/:section`

- **Mô tả**: Lấy thông số cấu hình của một phần cụ thể (`store`, `notifications`, `display`, `business`).
- **Quyền hạn**: `Admin`
- **Path Param**: `section`

#### `PUT /api/settings/:section`

- **Mô tả**: Cập nhật thông số cấu hình của một phần cụ thể.
- **Quyền hạn**: `Admin`
- **Path Param**: `section`

---

### 3.21. Newsletter (`/api/newsletter`)

#### `POST /api/newsletter/subscribe`

- **Mô tả**: Đăng ký nhận tin tức khuyến mãi và bản tin qua email.
- **Quyền hạn**: `Public` (Áp dụng `newsletterRateLimiter`)
- **Request Body (JSON)**:
  ```json
  {
    "email": "customer@example.com"
  }
  ```
- **Phản hồi (201)**:
  ```json
  {
    "status": "success",
    "code": 201,
    "message": "Subscribed to newsletter successfully"
  }
  ```

---

### 3.22. Notifications (`/api/notifications`)

_Tất cả route Notifications yêu cầu người dùng đăng nhập (`verifyAccessToken`)._

#### `POST /api/notifications`

- **Mô tả**: Admin gửi thông báo (toàn sàn hoặc cho một người dùng cụ thể).
- **Quyền hạn**: `Admin`
- **Request Body (JSON)**:
  ```json
  {
    "title": "Chương trình Siêu Sale 11/11",
    "message": "Hàng ngàn voucher giảm đến 50% đang chờ bạn!",
    "type": "promotion", // 'order_status' | 'promotion' | 'system' | 'chat' | 'shop_follow'
    "link": "/flash-sale",
    "recipient": "65df8a76b91234567890abcd" // Bỏ trống nếu là thông báo chung
  }
  ```

#### `GET /api/notifications`

- **Mô tả**: Lấy danh sách thông báo của người dùng hiện tại (có phân trang).
- **Quyền hạn**: `User`
- **Query Params**: `page` (default: 1), `limit` (default: 10)

#### `PATCH /api/notifications/read-all`

- **Mô tả**: Đánh dấu tất cả thông báo của người dùng là đã đọc.
- **Quyền hạn**: `User`

#### `DELETE /api/notifications`

- **Mô tả**: Xoá toàn bộ thông báo của người dùng.
- **Quyền hạn**: `User`

#### `GET /api/notifications/count`

- **Mô tả**: Lấy số lượng thông báo chưa đọc.
- **Quyền hạn**: `User`
- **Phản hồi (200)**: `{ "count": 3 }`

#### `GET /api/notifications/:id`

- **Mô tả**: Lấy chi tiết một thông báo theo ID.
- **Quyền hạn**: `User`
- **Path Param**: `id` (Notification ObjectId)

#### `PATCH /api/notifications/:id`

- **Mô tả**: Cập nhật trạng thái của một thông báo (ví dụ: chuyển sang đã đọc).
- **Quyền hạn**: `User`
- **Path Param**: `id` (Notification ObjectId)
- **Request Body (JSON)**: `{ "isRead": true }`

---

### 3.23. Reviews & Ratings (`/api/reviews`)

#### `GET /api/reviews/product/:productId`

- **Mô tả**: Lấy danh sách đánh giá của một sản phẩm.
- **Quyền hạn**: `Public`
- **Path Param**: `productId` (Product ObjectId)
- **Query Params**: `page`, `limit`, `rating` (1-5), `sort` (`'newest'`, `'oldest'`, `'highest'`, `'lowest'`)

#### `GET /api/reviews/shop/:shopId`

- **Mô tả**: Lấy danh sách đánh giá công khai cho một cửa hàng.
- **Quyền hạn**: `Public`
- **Path Param**: `shopId` (Shop ObjectId)

#### `GET /api/reviews/user/me`

- **Mô tả**: Lấy danh sách các đánh giá do chính người dùng hiện tại đã viết.
- **Quyền hạn**: `User`

#### `GET /api/reviews/check/:productId`

- **Mô tả**: Kiểm tra xem người dùng hiện tại có đủ điều kiện viết đánh giá cho sản phẩm không (Bắt buộc phải đã mua sản phẩm và đơn hàng đã giao thành công).
- **Quyền hạn**: `User`
- **Path Param**: `productId` (Product ObjectId)

#### `POST /api/reviews`

- **Mô tả**: Đăng đánh giá mới cho sản phẩm.
- **Quyền hạn**: `User` (Đã mua sản phẩm)
- **Request Body (JSON)**:
  ```json
  {
    "productId": "65df8a76b91234567890abcd",
    "rating": 5,
    "comment": "Chất vải cotton rất mềm mịn, đường may tinh xảo. Giao hàng nhanh!"
  }
  ```

#### `GET /api/reviews/seller/me`

- **Mô tả**: Người bán xem tất cả đánh giá của khách hàng về các sản phẩm thuộc shop mình.
- **Quyền hạn**: `Seller` hoặc `Admin`

#### `POST /api/reviews/seller/:reviewId/reply`

- **Mô tả**: Người bán phản hồi lại đánh giá của khách hàng.
- **Quyền hạn**: `Seller` hoặc `Admin`
- **Path Param**: `reviewId` (Review ObjectId)
- **Request Body (JSON)**:
  ```json
  {
    "reply": "Cảm ơn bạn đã ủng hộ shop! Chúc bạn có trải nghiệm tuyệt vời."
  }
  ```

#### `GET /api/reviews/statistics/overview`

- **Mô tả**: Thống kê số lượng sao đánh giá trên toàn hệ thống.
- **Quyền hạn**: `Admin`

#### `GET /api/reviews`

- **Mô tả**: Lấy toàn bộ đánh giá của hệ thống để kiểm duyệt.
- **Quyền hạn**: `Admin`

#### `GET /api/reviews/:reviewId`

- **Mô tả**: Xem chi tiết một bài đánh giá.
- **Quyền hạn**: `Public`
- **Path Param**: `reviewId` (Review ObjectId)

#### `PUT /api/reviews/:reviewId`

- **Mô tả**: Người mua chỉnh sửa đánh giá của chính mình.
- **Quyền hạn**: `User` (Chính chủ bài đánh giá)
- **Path Param**: `reviewId` (Review ObjectId)
- **Request Body (JSON)**: `{ "rating": 4, "comment": "..." }`

#### `DELETE /api/reviews/:reviewId`

- **Mô tả**: Xoá đánh giá.
- **Quyền hạn**: `User` (Chính chủ) hoặc `Admin`
- **Path Param**: `reviewId` (Review ObjectId)

---

### 3.24. Statistics (`/api/statistics`)

#### `GET /api/statistics/dashboard`

- **Mô tả**: Lấy số liệu thống kê tổng hợp toàn sàn cho Admin Dashboard (doanh thu, tổng người dùng, tổng sản phẩm, số đơn hàng theo thời gian).
- **Quyền hạn**: `Admin`
- **Phản hồi (200)**:
  ```json
  {
    "status": "success",
    "code": 200,
    "data": {
      "revenue": 1250000000,
      "totalOrders": 3450,
      "totalUsers": 1280,
      "totalProducts": 520
    }
  }
  ```

---

## 4. WebSocket (Socket.io) Gateway Events

Hệ thống cung cấp kết nối Realtime qua Socket.io tại cùng cổng của HTTP Server, được bảo mật qua `socketAuthMiddleware` (sử dụng Token/Cookie) và hỗ trợ mở rộng phân tán qua Redis Adapter (`@socket.io/redis-adapter`).

### 4.1. Kết Nối & Xác Thực

- **Endpoint kết nối**: `ws://localhost:5000/socket.io/?EIO=4&transport=websocket`
- **Headers / Auth**:
  ```javascript
  const socket = io('http://localhost:5000', {
    auth: { token: 'Bearer <ACCESS_TOKEN>' },
    withCredentials: true,
  });
  ```

### 4.2. Các Sự Kiện Chat (`chat.socket.js`)

1. `join_conversation`:
   - **Client gửi**: `conversationId` (string)
   - **Mục đích**: Tham gia vào room chat `conversation:<conversationId>`. Server kiểm tra quyền thành viên trước khi cho phép join.
   - **Server phản hồi**: `joined_conversation` `{ conversationId }` hoặc `error` `{ message }`.
2. `leave_conversation`:
   - **Client gửi**: `conversationId` (string)
   - **Mục đích**: Rời khỏi room chat.
   - **Server phản hồi**: `left_conversation` `{ conversationId }`.
3. Nhận tin nhắn mới trong room:
   - Client lắng nghe sự kiện `new_message` hoặc `message_received` được broadcast từ controller.

### 4.3. Các Sự Kiện Thông Báo (`notification.socket.js`)

Mỗi người dùng khi kết nối thành công sẽ tự động được join vào room riêng mang ID của chính họ: `socket.join(userId)`.

1. `get_notifications`:
   - **Client gửi**: `{ page: 1, limit: 10 }`
   - **Server phản hồi**: `list_notification` (Danh sách thông báo).
2. `mark_read_all`:
   - **Client gửi**: Không cần payload
   - **Server phản hồi**: `mark_read_all_success` `{ success: true }` và phát tín hiệu `unread_count` (0).
3. `clean_notifications`:
   - **Client gửi**: Không cần payload
   - **Server phản hồi**: `clean_notifications_success` `{ success: true }`.
4. `get_unread_count`:
   - **Client gửi**: Không cần payload
   - **Server phản hồi**: `unread_count` (Số int hiển thị số lượng chưa đọc).
