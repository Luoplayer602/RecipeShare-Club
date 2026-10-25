# Loki + Promtail + Alloy

Promtail và Alloy chạy song song, chia nguồn thu để không nhân đôi log:

```text
Nginx access/error → Promtail UDP 1515/1516 ─┐
Next.js API/server → Alloy UDP 1514 ────────┴→ Loki :3100 → Grafana
```

Promtail có mặt để đáp ứng thành phần trong đề thực hành. Grafana đã kết thúc hỗ trợ Promtail ngày 02/03/2026; không còn cập nhật hoặc hỗ trợ mới. Alloy tiếp tục phục vụ log ứng dụng. [Thông báo chính thức](https://grafana.com/docs/loki/latest/send-data/promtail/).

## Khởi động và cấu hình

Tạo secrets và cấu hình theo [README](../README.md), sau đó sử dụng đúng file env của hệ thống đang vận hành:

```powershell
$composeEnv = '.env.production.local'
$composeArgs = @('--env-file', $composeEnv, '-f', 'compose.yaml', '-f', 'compose.production.yaml')
docker compose @composeArgs up -d --wait
docker compose @composeArgs ps promtail alloy loki nginx
```

- Promtail dùng `infra/promtail/config.yml`, chỉ nhận syslog Nginx định dạng RFC3164. Không mở cổng host, không đọc Docker socket hay file log của collector khác.
- Alloy dùng `infra/alloy/config.alloy`, chỉ nhận syslog Next.js định dạng RFC5424. Hai listener Nginx cũ đã được loại bỏ khỏi Alloy.
- Nginx chỉ có một đích syslog cho access và một đích cho error, cùng trỏ tới Promtail. Bản stdout/stderr trong Docker vẫn được giữ để chẩn đoán, không có collector thứ hai đọc chúng vào Loki.
- Hai collector đẩy tới `http://loki:3100/loki/api/v1/push` trong mạng Compose.
- Overlay production đặt `LOG_ENVIRONMENT=production` cho cả hai collector.
- Promtail chạy UID/GID `10001:10001`, root filesystem chỉ đọc, bỏ capabilities, bật `no-new-privileges`. `/tmp` là tmpfs riêng; file positions không cần volume vì không tail file. Log đã nhận được giữ trong volume Loki.
- Alloy chạy user `alloy`, có volume trạng thái riêng. Loki không publish cổng ra host; Grafana yêu cầu đăng nhập.

Khi thay cấu hình collector, recreate service tương ứng. Sau khi recreate Promtail hoặc app, restart Nginx để phân giải lại địa chỉ đích. Sau khi sửa Prometheus, restart Prometheus để nạp scrape config.

```powershell
docker compose @composeArgs up -d --no-deps --wait promtail alloy
docker compose @composeArgs restart nginx prometheus
```

Syslog dùng UDP, không có hàng đợi bền vững hoặc cam kết exactly-once; log có thể mất trong thời gian collector ngừng hoạt động. Kiểm thử không trùng xác nhận đường thu hiện tại, không thay đổi đặc tính giao thức này.

## Nội dung và labels

| Nguồn | Collector | Nội dung |
|---|---|---|
| Nginx access | Promtail | Method, path không query, status, thời gian, request ID |
| Nginx error | Promtail | Lỗi warn trở lên; pipeline replace che phần query thành `[redacted]` |
| Next.js `api_request` | Alloy | Route mẫu, method, status, duration và request ID |
| Next.js `server_started`, `server_error` | Alloy | Sự kiện khởi động/lỗi có cấu trúc, không ghi message/stack hoặc SQL |

Chỉ index `service_name`, `environment`, `kind` (Nginx) và `collector`. Request ID, URL, status và route không được tạo thành index labels. Loki có thể thêm structured metadata như `detected_level`. Log cũ trước chuyển đổi vẫn đọc được, có thể chưa có nhãn collector.

Nginx tạo và ghi đè `X-Request-ID` trước khi proxy, trả cùng ID trong response. Dùng ID để đối chiếu log hai nguồn, không dùng làm bằng chứng danh tính.

Log API không ghi query, body, cookie, authorization hay nội dung lỗi. Nginx access không ghi IP, referrer, user agent hoặc query. Native error có thể chứa IP/path; chỉ nhánh gửi Loki được che query, bản stderr Docker giữ định dạng native. Không đặt bí mật trực tiếp trong URL path.

## Truy vấn LogQL

Trong Grafana Explore, chọn datasource **Loki**, khoảng thời gian có traffic và refresh. Dashboard `/d/recipeshare-logs` sử dụng cùng datasource.

Log Nginx mới đi qua Promtail:

```logql
{service_name="nginx", collector="promtail", environment="production"}
```

Log API đi qua Alloy:

```logql
{service_name="nextjs", collector="alloy", environment="production"} | json
```

API trả lỗi 5xx:

```logql
{service_name="nextjs"} | json | event="api_request" | status >= 500 | __error__=""
```

Đối chiếu một request qua hai collector:

```logql
{service_name=~"nginx|nextjs"} |= "THAY_BANG_REQUEST_ID"
```

Log lỗi Nginx đã qua pipeline che query:

```logql
{service_name="nginx", kind="error", collector="promtail"}
```

Các dashboard hiện có lọc theo `service_name`/`kind`, nên tiếp tục đọc được cả log cũ và log mới.

## Kiểm tra

```powershell
node scripts/test-parallel-logging.mjs $composeEnv
```

Script tạo traffic đọc và một sự kiện syslog lỗi giả có query riêng để kiểm chứng pipeline; không tạo tài khoản, không sửa bài, không restart DB và không xóa volume. Nó kiểm tra:

- Năm request thật có đúng một sự kiện Nginx qua Promtail và một sự kiện API qua Alloy cho mỗi request ID.
- Query thử không xuất hiện trong Loki; error giả còn dấu `[redacted]`.
- Promtail non-root, read-only, không publish cổng hoặc mount Docker socket.
- Chín target Prometheus đều up và các biểu thức dashboard log vẫn truy vấn thành công.

Sự kiện kiểm thử ở lại Loki theo retention. Test dùng chính certificate làm CA, không tắt xác minh TLS. Script `scripts/test-logging.mjs` dành cho cấu hình nền cũng đã đổi nơi bơm error giả sang Promtail và chấp nhận label collector.

Ngày 25/10/2026, kiểm thử trên hệ thống full Docker đã đạt. Kiểm tra đọc lại website, 12 bài công khai, 12 ảnh bìa và tìm kiếm kết hợp đạt sau chuyển đổi; dữ liệu người dùng được giữ nguyên.

Nếu thiếu log, kiểm tra `ps`, log `promtail alloy loki nginx app`, khoảng thời gian và labels trong Explore. Promtail healthy chỉ xác nhận listener hoạt động; dùng bài kiểm thử để xác nhận toàn bộ đường đi tới Loki.
