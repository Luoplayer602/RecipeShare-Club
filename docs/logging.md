# Loki + Grafana Alloy

Next.js tiếp tục chạy trên Windows bằng `pnpm dev`. Nginx và Next.js gửi syslog đến Alloy; Alloy đẩy log vào Loki. Grafana đọc Loki qua mạng Compose.

```text
Nginx access JSON / error → Alloy UDP 1515 / 1516 ─┐
Next.js API / server      → localhost UDP 1514 ───┴→ Loki :3100 → Grafana :3002
```

## Khởi chạy hằng ngày

Từ thư mục gốc:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/init-local.ps1
docker compose up -d --wait
docker compose restart nginx
```

Restart Nginx sau khi tạo lại Alloy để Nginx phân giải lại địa chỉ collector; syslog của Nginx giữ IP đã phân giải lúc nạp cấu hình. Với restart thông thường, container Alloy giữ IP. Nếu cần chạy riêng Nginx, Compose vẫn tự khởi động Alloy và chờ healthcheck.

Trong terminal riêng:

```powershell
cd app
pnpm.cmd dev --hostname 0.0.0.0 --port 3000
```

Script khởi tạo thêm `LOG_SYSLOG_PORT=1514` vào `app/.env.local` nếu chưa có, giữ nguyên các cấu hình/secret hiện hữu. Khởi động lại Next.js nếu tiến trình đang chạy chưa nhận biến mới. `LOG_SYSLOG_HOST` mặc định `127.0.0.1`; bỏ `LOG_SYSLOG_PORT` hoặc đặt `0` để tắt log syslog. Đổi port cần sửa đồng thời mapping Compose và biến ứng dụng.

- Ứng dụng: http://localhost:8080
- Dashboard log: http://localhost:3002/d/recipeshare-logs
- Explore: http://localhost:3002/explore — chọn datasource **Loki**.
- Đăng nhập Grafana như trước: `admin`, mật khẩu trong `.secrets/grafana_admin_password.txt`.

Loki không publish cổng host, Alloy chỉ publish UDP 1514 trên localhost để nhận Next.js. Không mount Docker socket. Alloy chạy bằng user `alloy`, filesystem container chỉ đọc trừ volume dữ liệu. Loki single-binary không bật xác thực nội bộ; chỉ dùng trong mạng phát triển tin cậy. Grafana vẫn yêu cầu đăng nhập.

## Các sự kiện đang thu

| Nguồn | Nội dung |
|---|---|
| Nginx access | Method, path không query string, status, thời gian tổng/upstream, request ID |
| Nginx error | Lỗi mức warn trở lên; Alloy che query string trước khi gửi vào Loki |
| Next.js `api_request` | Route mẫu, method, status, duration_ms và request ID cho API có `measureApi` |
| Next.js `server_started` | Instrumentation được khởi tạo ở Node runtime |
| Next.js `server_error` | Lỗi server Next.js bắt được: route mẫu, method, loại route, request ID |

API dùng route cố định như `/api/posts/[id]`, không ghi ID thật, query, body, cookie, authorization, nội dung lỗi hoặc SQL. `onRequestError` cũng không ghi message/stack; xem terminal Next.js khi cần stack chi tiết. Không tự thu toàn bộ stdout/stderr, log trình duyệt, log build hoặc lỗi compile. Vì vậy đây là pipeline sự kiện ứng dụng có cấu trúc, không phải bản sao terminal.

Nginx ghi path thực trong nội dung access log; native error có thể chứa IP và path. Query trong error chỉ được che trên nhánh gửi Loki, bản stderr trong Docker giữ định dạng native. Tránh đặt thông tin bí mật trực tiếp trong URL path. Access log không ghi IP, referrer, user agent, query hoặc body.

Nginx tạo và ghi đè `X-Request-ID` khi proxy, trả ID này trong response. Next.js nhận ID gồm 32 ký tự hex để nối log; request đi trực tiếp đến Next.js không qua proxy sẽ có ID riêng nếu thiếu ID hợp lệ. Request ID phục vụ đối chiếu, không dùng làm bằng chứng danh tính.

Chỉ index `service_name`, `environment` và `kind` (Nginx access/error). Route, status, ID ở trong JSON, trích xuất khi truy vấn; Loki có thể bổ sung structured metadata `detected_level` tự động. Không index user/URL/request ID.

## Truy vấn LogQL trong Explore

Chọn **Last 30 minutes**, refresh **15s**, tạo traffic qua ứng dụng rồi đợi vài giây. Các truy vấn sau dùng LogQL, khác PromQL của datasource Prometheus.

Toàn bộ sự kiện Next.js:

```logql
{service_name="nextjs"} | json
```

API trả 5xx:

```logql
{service_name="nextjs"} | json | event="api_request" | status >= 500 | __error__=""
```

401/403 để xem yêu cầu bị từ chối:

```logql
{service_name="nextjs"} | json | status >= 400 | status < 500 | __error__=""
```

API chậm hơn 500 ms:

```logql
{service_name="nextjs"} | json | event="api_request" | duration_ms > 500 | __error__=""
```

Lọc route cụ thể:

```logql
{service_name="nextjs"} | json | route="/api/posts/[id]"
```

Đối chiếu hai nguồn bằng ID từ response header, thay giá trị ví dụ bằng ID thật:

```logql
{service_name=~"nginx|nextjs"} |= "THAY_BANG_REQUEST_ID"
```

Lỗi Nginx và lỗi server Next.js:

```logql
{service_name="nginx",kind="error"}
```

```logql
{service_name="nextjs"} | json | event="server_error"
```

Số request API mỗi giây theo status, dùng trong panel Time series:

```logql
sum by (status) (
  rate({service_name="nextjs"} | json | event="api_request" | __error__="" [1m])
)
```

Dashboard provisioned dùng `$__auto` thay `[1m]` để Grafana chọn cửa sổ phù hợp. Không có log phù hợp có thể thấy No data; điều đó không tự chứng minh collector bị lỗi. Prometheus vẫn là nguồn metrics/cảnh báo chính, log rate chỉ phản ánh sự kiện đã thu được.

## Giữ dữ liệu và giới hạn

Loki giữ log 7 ngày, compactor xóa nền nên không phải giới hạn dung lượng đĩa cứng. Volume `loki_data` giữ log qua restart/recreate; `alloy_data` giữ trạng thái collector. Không chạy `docker compose down -v` với dữ liệu cần giữ. Log console Docker vẫn xoay tối đa 3 × 10 MB/service như trước.

Syslog UDP là best effort: có thể mất log khi Alloy dừng, mạng nghẽn hoặc bị quá tải. Logger Next.js không chờ collector và không lưu backlog ra đĩa; mất collector không được làm API lỗi. Alloy dùng batching/retry khi đẩy Loki, chưa bật WAL thử nghiệm nên không đảm bảo giữ batch qua crash. Pipeline này dành cho quan sát local, không dùng làm audit log bắt buộc.

Prometheus scrape thêm `loki` và `alloy`. `up` kiểm tra endpoint metrics, không thay thế kiểm thử ghi/đọc log. Alloy có healthcheck `/-/healthy`; image Loki tối giản không có shell/wget nên kiểm tra Loki qua datasource health của Grafana và test end-to-end, không gắn healthcheck shell giả.

## Kiểm tra và sửa cấu hình

Từ thư mục gốc:

```powershell
docker compose config --quiet
docker compose run --rm --no-deps alloy validate /etc/alloy/config.alloy
docker compose run --rm --no-deps loki '-config.file=/etc/loki/config.yml' '-verify-config=true'
node scripts/test-logging.mjs
node scripts/test-monitoring.mjs
```

Để kiểm tra lưu bền vững, `node scripts/test-logging.mjs --restart-check` sẽ restart riêng Loki và xác nhận sự kiện đã ghi vẫn đọc được. Trong khoảng restart, truy vấn log có thể tạm thời chưa sẵn sàng.

Test log gọi API đọc/không có phiên qua Nginx, đối chiếu request ID ở cả hai nguồn, kiểm tra query nhạy cảm không xuất hiện, kiểm tra labels và biểu thức dashboard. Test tạo sự kiện 500 bằng handler giả trong tiến trình test và bơm một syslog error giả vào Alloy để kiểm tra che query; không thêm endpoint lỗi public, không dừng DB và không tạo bài/tài khoản. Các sự kiện test ở lại Loki theo retention.

Từ `app/`:

```powershell
node scripts/test-logging.mjs
node scripts/test-metrics.mjs
pnpm.cmd exec tsc --noEmit
pnpm.cmd lint
pnpm.cmd build
```

Khi sửa Alloy/Loki/datasource, restart service tương ứng. Khi recreate Alloy, restart Nginx sau đó. Dashboard JSON được Grafana nạp lại trong khoảng 30 giây; muốn thực hành lưu UI thì tạo dashboard mới.

Nếu thiếu log: kiểm tra `docker compose ps`, `docker compose logs --tail 50 alloy loki`, biến `LOG_SYSLOG_PORT` của Next.js, datasource Loki trong Grafana và khoảng thời gian Explore. Healthcheck Alloy đạt chưa đảm bảo Loki nhận log; dùng `node scripts/test-logging.mjs` để kiểm tra cả đường đi.

## Kết quả xác minh 24/10/2026

- Cấu hình Compose, Alloy validate, Loki verify-config và Nginx syntax đạt. Alloy healthy, Loki được xác nhận bằng ghi/đọc log thật qua Grafana.
- Datasource/dashboard Loki đã provision; truy vấn các panel không lỗi. Log Nginx/Next.js nối được bằng request ID, query marker không lọt vào Loki, nhánh error Nginx che query đúng. Sự kiện 500 được giả lập trong tiến trình test.
- Log đã ghi vẫn đọc được sau restart riêng Loki; không xóa volume.
- Sáu target Prometheus đều up, kiểm thử rules cảnh báo đạt.
- Logger/metrics unit tests, TypeScript, ESLint và production build đạt. Build vẫn có hai cảnh báo tracing media đã có từ trước.
- Reverse proxy, origin guards, WebSocket HMR, đăng nhập, upload, nháp/xuất bản và hồi quy Chrome cho chỉnh ảnh/quản lý bài đều đạt. Lần chạy browser đầu bị gián đoạn khi restart Nginx trong lúc test; chạy lại sau khi service ổn định đạt. Tài khoản/bài/file thử đã dọn; các log kiểm thử giữ theo retention.
- Chưa chụp ảnh dashboard log hoặc xác minh màn hình Grafana bằng mắt; datasource và biểu thức dashboard được kiểm tra qua API. Chưa triển khai HTTPS, thông báo ngoài hay đóng gói Next.js bằng Docker.

Nguồn cấu hình: [Alloy syslog](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.syslog/), [Alloy Loki writer](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.write/), [Loki single binary](https://grafana.com/docs/loki/latest/setup/install/docker/), [Nginx syslog](https://nginx.org/en/docs/syslog.html). Next.js instrumentation được đối chiếu với tài liệu đi kèm phiên bản đang cài trong `app/node_modules/next/dist/docs`.
