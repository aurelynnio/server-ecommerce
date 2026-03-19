# Server E-commerce

# Hello World

Backend API cho hệ thống thương mại điện tử, được xây dựng bằng Node.js và Express.

## 🛠 Công nghệ sử dụng

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) (với Mongoose ODM)
- **Authentication**: JWT (JSON Web Token)
- **Realtime**: [Socket.io](https://socket.io/)
- **Payment Gateway**: VNPay
- **File Storage**: Cloudinary (Multer storage)
- **Logging**: Morgan
- **Security**: Helmet, Cors, Rate Limit

## ✨ Tính năng chính

- **RESTful API**: Cung cấp đầy đủ các endpoints cho Client.
- **Authentication & Authorization**:
  - Đăng ký, đăng nhập, refresh token.
  - Phân quyền User/Admin qua Middleware.
- **Quản lý dữ liệu**:
  - CRUD cho Products, Categories, Users, Orders.
  - Xử lý logic giỏ hàng và mã giảm giá (Discounts).
- **Thanh toán**: Tích hợp cổng thanh toán VNPay.
- **Thông báo**: Gửi thông báo realtime tới client khi có đơn hàng mới hoặc cập nhật trạng thái.
- **Upload ảnh**: Upload ảnh sản phẩm lên Cloudinary.

## 🚀 Cài đặt và chạy dự án

1. **Cài đặt dependencies**:

   ```bash
   npm install
   ```

2. **Cấu hình môi trường**:
   Tạo file `.env` dựa trên file `.env.example` (nếu có) hoặc cấu hình các biến:
   - `PORT`: Cổng chạy server (ví dụ: 5000).
   - `MONGODB_URI`: Chuỗi kết nối MongoDB.
   - `JWT_SECRET`: Secret key cho JWT.
   - `CLOUDINARY_*`: Cấu hình Cloudinary.
   - `VNPAY_*`: Cấu hình VNPay.

3. **Chạy server development**:
   ```bash
   npm run dev
   ```
   Server sẽ chạy tại `http://localhost:5000` (mặc định).

## 📂 Cấu trúc thư mục

- `src/configs`: Cấu hình hệ thống (DB, Cloudinary, Upload...).
- `src/controllers`: Xử lý logic request/response.
- `src/models`: Mongoose Schemas.
- `src/routes`: Định nghĩa các API endpoints.
- `src/services`: Business logic layer.
- `src/middlewares`: Middleware xác thực, log, xử lý lỗi.
- `src/utils`: Các hàm tiện ích.
