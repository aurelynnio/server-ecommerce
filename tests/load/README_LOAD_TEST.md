# Hướng Dẫn Setup JMeter: Test Kịch Bản RabbitMQ Làm Lá Chắn Cho MongoDB (Flash Sale / Giờ Cao Điểm)

Tài liệu này hướng dẫn chi tiết từ lý thuyết kiến trúc đến thực hành từng bước cấu hình Apache JMeter để kiểm thử khả năng chịu tải cao (Stress / Concurrency Load Testing) trong kịch bản săn sale (Flash Sale), sử dụng **RabbitMQ làm lá chắn (Shock Absorber / Traffic Leveling Buffer)** bảo vệ cơ sở dữ liệu **MongoDB**.

---

## 1. Bản Chất Bài Toán & Kiến Trúc "Lá Chắn"

### 1.1. Tại sao MongoDB bị nghẽn (Bottleneck) khi Săn Sale?

Trong các đợt Flash Sale (ví dụ mở bán 100 chiếc điện thoại lúc 12:00:00 trưa), hàng ngàn người dùng cùng bấm nút **"Mua ngay"** trong cùng 1 giây.
Nếu hệ thống xử lý đồng bộ và ghi trực tiếp vào MongoDB (**Direct Synchronous Write**):

1. **Tranh chấp khóa & Xung đột ghi (Write Conflict - Error Code 112)**:
   - Hàng trăm transaction cùng tìm cách đọc và ghi đè lên document của cùng một sản phẩm (giảm tồn kho `stock: { $inc: -1 }`).
   - Bộ máy lưu trữ **WiredTiger** của MongoDB phát hiện xung đột và liên tục hủy (abort) transaction rồi retry.
   - Khi hàng trăm request retry liên tục, CPU MongoDB vọt lên **100%**, Lock Percentage đạt đỉnh.
2. **Cạn kiệt Connection Pool (Connection Pool Exhaustion)**:
   - Mỗi request HTTP giữ 1 connection tới MongoDB trong lúc chờ transaction hoàn tất.
   - Connection pool (mặc định 10 - 100 connections) nhanh chóng cạn kiệt, các request sau bị dồn ứ trong hàng đợi connection -> Gây lỗi `504 Gateway Timeout` hoặc `ETIMEDOUT`.
3. **Hiệu ứng sập dây chuyền (Cascading Failure)**:
   - Node.js Event Loop bị nghẽn I/O, bộ nhớ RAM phình to, toàn bộ API của hệ thống (kể cả xem sản phẩm, đăng nhập) bị tê liệt.

---

### 1.2. RabbitMQ đóng vai trò "Lá Chắn" như thế nào?

Mô hình kiến trúc lá chắn hoạt động theo nguyên lý **"Hồ Chứa Lũ" (Rate-Leveling / Shock Absorber)**:

```
[Hàng Ngàn Khách Hàng Săn Sale]
        │ (10,000 requests/s - Bão đơn)
        ▼
   [Nginx / API Gateway]
        │
        ▼
   [Node.js Express API]  ◄─── (1) Validate token & Check tồn kho ảo bằng Redis Atomic Decrby (<2ms)
        │
        ├──► (2) Bắn Order Message vào RabbitMQ Exchange (Persistent: true)
        │
        └──► (3) Trả về NGAY: HTTP 202 Accepted / 201 Created (10 - 20ms!)
                 (Khách hàng thấy màn hình: "Đang xử lý đơn hàng...")
        │
        ▼
 ╔══════════════════════════════════════════════════════════════════╗
 ║               RABBITMQ "LÁ CHẮN" (BUFFER QUEUE)                  ║
 ║  • Hàng đợi order_queue: Tích lũy 10,000+ messages an toàn      ║
 ║  • Durable: true, Persistent: true (Không bao giờ mất dữ liệu)   ║
 ║  • Dead Letter Queue (DLQ): Tự động retry nếu có lỗi tạm thời    ║
 ╚══════════════════════════════════════════════════════════════════╝
        │
        │ (4) Worker rút tin nhắn theo tốc độ kiểm soát (Controlled Rate)
        │     Prefetch = 50 (Little's Law: định lượng vừa sức chịu đựng của DB)
        ▼
  [Order Worker Consumer Pool]
        │
        │ (5) Ghi nhịp nhàng vào MongoDB (200 - 400 operations/giây)
        ▼
   [MongoDB Atlas / WiredTiger]  ───► CPU ổn định ở mức 40-50%, KHÔNG CÓ Write Conflict!
        │
        ▼
   (6) Bắn WebSocket (Socket.IO) / Notification báo đơn thành công cho người mua & người bán
```

### 1.3. Bảng So Sánh Hai Mô Hình

| Tiêu Chí                             | Ghi Trực Tiếp (Không có Queue)             | Có Lá Chắn RabbitMQ Buffer                    |
| :----------------------------------- | :----------------------------------------- | :-------------------------------------------- |
| **Thời gian phản hồi (API Latency)** | 3,000ms – 15,000ms (Spike vọt trần)        | **10ms – 30ms** (Phẳng, siêu nhanh)           |
| **Throughput (RPS)**                 | Thấp (50 – 150 req/s là bắt đầu nghẽn)     | **Cao gấp 10-20 lần** (1,000 – 5,000 req/s)   |
| **Trạng thái MongoDB**               | CPU 100%, WriteConflict liên miên, dễ sập  | **CPU 40-50%**, ghi đều đặn, không xung đột   |
| **Trải nghiệm khách hàng**           | Treo màn hình, quay vòng tròn, báo lỗi 504 | Mượt mà, nhận kết quả ngay trong tích tắc     |
| **Xử lý sự cố (Resilience)**         | Lỗi là mất đơn hàng                        | Lưu trong DLQ/Retry Queue, **Zero Data Loss** |

---

## 2. Hướng Dẫn Cấu Hình Kịch Bản Trong Apache JMeter

File kịch bản chuẩn mực đã được lưu sẵn tại:
`tests/load/rabbitmq-order-concurrency.jmx`

Dưới đây là chi tiết từng thành phần trong kịch bản để bạn hiểu rõ cách thiết lập:

### 2.1. User Defined Variables (Biến môi trường)

Khai báo các biến với hàm `${__P(param, default)}` để vừa chạy được trên GUI, vừa truyền được tham số linh hoạt từ dòng lệnh CLI:

- `HOST`: `${__P(host,localhost)}`
- `PORT`: `${__P(port,5000)}`
- `THREADS`: `${__P(threads,50)}` (Số lượng người dùng đồng thời)
- `RAMPUP`: `${__P(rampup,5)}` (Thời gian tăng tốc lên đủ số thread)
- `DURATION`: `${__P(duration,30)}` (Thời gian chạy test tính bằng giây)
- `SYNC_USERS`: `${__P(sync_users,25)}` (Số lượng user gom lại để bắn bão đơn)
- `PRODUCT_ID`: `${__P(productId,6a898b89c10c01f77709d2de)}`
- `ADDRESS_ID`: `${__P(addressId,6aa392c05596407a26c31532)}`

### 2.2. CSV Data Set Config (Mô phỏng nhiều User thật)

Không nên dùng 1 tài khoản cho 1,000 threads vì ngoài thực tế mỗi người săn sale là một tài khoản khác nhau:

- **Filename**: `${__P(csv_file,tests/load/test-users.csv)}`
- **Variable Names**: `USER_ID,TOKEN,ADDRESS_ID,PRODUCT_ID`
- **Delimiter**: `,`
- **Ignore first line**: `True`
- **Recycle on EOF**: `True`

### 2.3. Synchronizing Timer (Vũ khí tạo Bão Đơn Flash Sale)

Đây là phần quan trọng nhất để mô phỏng **đúng 12:00:00**:

- Bình thường các thread trong JMeter sẽ chạy rải rác lệch nhau vài mili-giây.
- **Synchronizing Timer (Rendezvous Point)** giữ chân các threads lại. Khi nào đủ số lượng `groupSize` (ví dụ 25 hoặc 50 threads), timer sẽ mở chốt để **toàn bộ các threads cùng bắn request trong cùng 1 mili-giây**!
- Cấu hình:
  - **Number of Simulated Users to Group by**: `${SYNC_USERS}`
  - **Timeout in milliseconds**: `5000` (nếu sau 5s chưa gom đủ số thread thì vẫn thả ra để tránh deadlock).

### 2.4. HTTP Header Manager

- `Content-Type`: `application/json`
- `Accept`: `application/json`
- `Authorization`: `Bearer ${TOKEN}` (Lấy token động từ CSV hoặc biến môi trường)
- `X-Idempotency-Key`: `${__UUID()}` (Tạo mã chống trùng lặp đơn hàng độc nhất cho từng lượt request)

### 2.5. HTTP Request Sampler (POST /api/orders/buy-now)

- **Method**: `POST`
- **Path**: `/api/orders/buy-now`
- **Body Data**:

```json
{
  "productId": "${PRODUCT_ID}",
  "quantity": 1,
  "addressId": "${ADDRESS_ID}",
  "paymentMethod": "cod"
}
```

### 2.6. Response Assertion (Kiểm soát tính đúng đắn)

- Đặt assertion kiểm tra mã trạng thái trả về:
  - `201`: Tạo đơn thành công (Synchronous checkout hoàn tất).
  - `202`: Đơn hàng đã tiếp nhận vào hàng đợi xử lý (Asynchronous queue).
  - `409` hoặc `400`: Hết hàng tồn kho flash sale (Đây là logic kinh doanh đúng đắn khi sản phẩm đã bị săn hết, không được tính là lỗi hạ tầng).
- Đánh dấu **Fail** nếu gặp các mã lỗi server: `500`, `502`, `503`, `504` hoặc connection timeout.

### 2.7. JSON Extractor (Trích xuất mã đơn hàng)

- Trích xuất `ORDER_GROUP_ID` từ `$.data.orderGroupId` để xác minh đơn hàng đã được hệ thống tạo hợp lệ.

---

## 3. Các Bước Thực Hành Chạy Test Từ A Đến Z

### Bước 1: Khởi động hệ thống Backend

Đảm bảo MongoDB, Redis, RabbitMQ và Server Node.js đang chạy:

```powershell
# Chạy server ở chế độ phát triển
npm run dev

# HOẶC chạy production với PM2 tách riêng API và Worker:
pm2 start ecosystem.config.js
```

Kiểm tra trạng thái server:
Truy cập: `http://localhost:5000/api/health` -> Nhận `{ status: "ok" }`.

---

### Bước 2: Chuẩn bị dữ liệu kiểm thử (Tự động 100%)

Chạy script chuẩn bị dữ liệu:

```powershell
node tests/load/prepare-test-data.js --users 50
```

Script sẽ tự động:

- Kiểm tra hoặc kích hoạt tồn kho Flash Sale (50,000 cái).
- Lấy hoặc tạo 50 tài khoản buyer có địa chỉ giao hàng hợp lệ.
- Sinh 50 JWT Access Token hợp lệ.
- Xuất file `tests/load/test-users.csv` sẵn sàng cho JMeter.

---

### Bước 3: Chạy Kiểm Thử Tải Bằng PowerShell Tự Động (Khuyến nghị)

Sử dụng script `run-loadtest.ps1` để tự động hóa toàn bộ quá trình:

```powershell
# Chạy với 50 người dùng đồng thời trong 30 giây, gom nhóm bão sale 25 user
.\tests\load\run-loadtest.ps1 -Threads 50 -Duration 30 -SyncUsers 25

# Muốn tăng tải lên 100 hoặc 200 users:
.\tests\load\run-loadtest.ps1 -Threads 100 -Duration 60 -SyncUsers 50 -PrepareData
```

Script sẽ tự động dọn dẹp kết quả cũ, chạy JMeter ở chế độ Non-GUI và **tự động mở Báo cáo Dashboard HTML** trên trình duyệt của bạn!

---

### Bước 4 (Tùy chọn): Chạy thủ công qua JMeter CLI

Nếu bạn muốn tự gõ lệnh:

```powershell
& "C:\Users\cyhin\Downloads\apache-jmeter-5.6.3\apache-jmeter-5.6.3\bin\jmeter.bat" `
  -n -t tests\load\rabbitmq-order-concurrency.jmx `
  -Jthreads=50 `
  -Jrampup=5 `
  -Jduration=30 `
  -Jsync_users=25 `
  -l tests\load\results.jtl `
  -e -o tests\load\report
```

---

### Bước 5 (Tùy chọn): Mở trên giao diện đồ họa JMeter GUI

Nếu bạn muốn xem cấu trúc Test Plan bằng mắt:

1. Chạy lệnh mở JMeter GUI:
   ```powershell
   & "C:\Users\cyhin\Downloads\apache-jmeter-5.6.3\apache-jmeter-5.6.3\bin\jmeter.bat"
   ```
2. Chọn **File -> Open** -> Tìm đến file `tests\load\rabbitmq-order-concurrency.jmx`.
3. Bạn sẽ thấy cây kịch bản đầy đủ: _User Defined Variables, HTTP Request Defaults, CSV Data Set, Thread Group, SyncTimer, Header Manager, HTTP Sampler, Assertions, Aggregate Report_.
4. Bấm nút **Play (Nút màu xanh)** để chạy thử nghiệm mẫu (chú ý: trên GUI chỉ nên test 5-10 threads để tránh ngốn RAM máy tính).

---

## 4. Cách Giám Sát (Monitoring) Trong Lúc Chạy Test

Để thấy rõ sức mạnh của RabbitMQ làm lá chắn, hãy mở đồng thời 3 màn hình giám sát:

### 4.1. Giám sát RabbitMQ Management UI

1. Mở trình duyệt truy cập: `http://localhost:15672`
2. Đăng nhập: `guest` / `guest` (hoặc tài khoản trong file `.env`: `ecommerce` / `rqC9xT2mKd4vLp8sWz6nQh0JbE5aF3uY`).
3. Vào tab **Queues** -> Tìm hàng đợi `order_queue`:
   - **Ready**: Số lượng tin nhắn đang chờ xử lý. Khi đợt bão sale dội vào, con số này sẽ **tăng vọt lên** (ví dụ lên 500 - 2,000 messages) -> Đây là bằng chứng RabbitMQ đã **hứng trọn cú sốc** tải mà không để dội xuống MongoDB!
   - **Unacked**: Số lượng tin nhắn Worker đang giữ để xử lý (chính là giá trị `PREFETCH = 50`).
   - **Publish rate**: Tốc độ nhận đơn từ API (đường màu xanh lá cây vọt lên cao).
   - **Consumer ack rate**: Tốc độ Worker ghi vào MongoDB và hoàn tất (đường màu vàng đi đều đặn, bằng phẳng). Sau khi kết thúc bão sale, số tin nhắn `Ready` sẽ giảm dần về 0.

### 4.2. Giám sát MongoDB

1. Mở MongoDB Compass hoặc terminal `mongostat`.
2. Quan sát:
   - **Connections**: Số lượng kết nối duy trì ở mức pool ổn định (25 connections), không bị spike vọt lên hàng ngàn làm tràn RAM.
   - **Write Conflicts / Aborts**: Giữ ở mức **0** hoặc cực kỳ thấp.
   - **Memory & CPU**: Đều đặn, không bị sốc nhiệt 100%.

### 4.3. Đọc Báo Cáo HTML Dashboard Của JMeter

Mở file `tests/load/report/index.html`:

- **APDEX (Application Performance Index)**: Điểm đánh giá mức độ hài lòng của người dùng (từ 0 đến 1.0). Nếu hệ thống mượt, điểm sẽ đạt > 0.9.
- **Summary Statistics**:
  - **Throughput (Transactions/s)**: Số đơn hàng hệ thống tiếp nhận được mỗi giây.
  - **90th pct / 95th pct / 99th pct**: 90%, 95%, 99% khách hàng nhận phản hồi trong bao nhiêu mili-giây. Với RabbitMQ làm lá chắn, con số này thường chỉ dưới 50ms!
  - **Error %**: Phải đạt `0.00%` (không có lỗi kết nối mạng hoặc lỗi server sập).
- **Charts -> Over Time -> Response Times Over Time**: Đường biểu diễn thời gian phản hồi phẳng lì, không bị dựng đứng.

---

## 5. Tối Ưu Nâng Cao Cho Môi Trường Production

1. **Công thức định cỡ Prefetch (Little's Law)**:
   Trong file `src/workers/order.worker.js`:
   $$\text{Prefetch} = \frac{\text{Target Throughput} \times \text{Average Processing Time (giây)}}{\text{Số Worker}}$$
   - Ví dụ: Mục tiêu xử lý 1,000 đơn/giây, mỗi đơn ghi DB mất 50ms (0.05s), có 2 worker:
     $$\text{Prefetch} = \frac{1000 \times 0.05}{2} = 25$$
   - Tuyệt đối tránh đặt `prefetch = 1` vì sẽ biến consumer thành cơ chế "Stop-and-Wait", lãng phí 90% thời gian chờ round-trip network ACK.

2. **Cấu hình Heap Memory cho JMeter**:
   Khi test từ 1,000 – 5,000 threads, hãy mở file `C:\Users\cyhin\Downloads\apache-jmeter-5.6.3\apache-jmeter-5.6.3\bin\jmeter.bat` và sửa dòng HEAP:

   ```cmd
   set HEAP=-Xms2g -Xmx4g -XX:MaxMetaspaceSize=512m
   ```

3. **Cluster Mode & Tách Process (PM2)**:
   Trong file `ecosystem.config.js`, tách riêng process nhận HTTP API và process Worker chạy nền. Khi đó, việc ghi vào MongoDB của Worker không hề chiếm dụng CPU hay Event Loop của API tiếp nhận đơn hàng.
