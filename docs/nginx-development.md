# Nginx reverse proxy trong giai đoạn phát triển

Next.js chạy trên máy ở cổng 3000. Nginx chạy bằng Docker Desktop và chuyển tiếp cả giao diện, API, media và WebSocket tới `host.docker.internal:3000`. MySQL/phpMyAdmin giữ cấu hình hiện tại. Chưa đóng gói Next.js, chưa thêm hệ thống giám sát.

```text
Trình duyệt → localhost:8080 → Nginx (Docker) → host.docker.internal:3000 → Next.js (Windows)
                                                                          ↓
                                                               localhost:3307 → MySQL (Docker)
```

## Chạy

Từ thư mục gốc, khởi tạo `.env` và secrets nếu chưa có theo README, rồi:

```powershell
docker compose config --quiet
docker compose up -d --wait
```

Trong terminal riêng:

```powershell
cd app
pnpm.cmd dev --hostname 0.0.0.0 --port 3000
```

Mở http://localhost:8080. Sửa code và debug như trước, không cần build image. Cấu hình hiện tại dành cho Docker Desktop; tên `host.docker.internal` được Docker cung cấp để truy cập dịch vụ trên host. Khi chuyển Next.js vào Compose sau này sẽ đổi upstream sang tên service ứng dụng.

`WEB_PORT` chỉ đổi cổng truy cập Nginx; upstream vẫn là Next.js cổng 3000. Muốn dùng cổng Next.js khác, sửa upstream trong `infra/nginx/default.conf` rồi kiểm tra/reload Nginx.

## Kiểm tra và cập nhật cấu hình

```powershell
docker compose exec nginx nginx -t
docker compose exec nginx nginx -s reload
curl.exe http://localhost:8080/health/live
curl.exe http://localhost:8080/api/health/db
cd app
node scripts/test-origin.mjs
node scripts/test-reverse-proxy.mjs
```

Script reverse-proxy cần Next.js ở chế độ dev, kiểm tra cả HMR WebSocket và yêu cầu cùng/khác origin; không tạo dữ liệu. Để kiểm tra đăng nhập/đăng xuất thật qua trình duyệt:

```powershell
$env:TEST_BASE_URL='http://localhost:8080'
node scripts/test-auth-navigation.mjs
```

Kiểm tra trình duyệt tạo tài khoản riêng và dọn lại sau khi chạy. `.env.local` phải có kết nối runtime DB như README.

## Những điểm cần hiểu

- `/health/live` chỉ xác nhận Nginx sống, vẫn trả 200 khi Next.js dừng. `/api/health/db` kiểm tra ứng dụng và DB, trả lỗi proxy khi Next.js không chạy. Vì vậy container Nginx healthy không có nghĩa toàn bộ ứng dụng healthy.
- Nginx giữ nguyên `Host` kèm cổng và đặt lại các header forwarding. API so Origin với host trình duyệt truy cập, không so với URL nội bộ cổng 3000; Origin khác host/cổng hoặc `Sec-Fetch-Site: cross-site` vẫn bị chặn.
- Tắt response buffering để giữ streaming của Next.js; chuyển tiếp Upgrade/Connection để hot reload qua WebSocket. Không thêm cache cho trang/API trong giai đoạn này.
- Giới hạn Nginx 51 MiB cho multipart; ứng dụng vẫn kiểm tra riêng ảnh 5 MiB và video 50 MiB. Request streaming không gom toàn bộ upload vào bộ nhớ Nginx trước khi gửi upstream.
- Giữ `nosniff`, chống nhúng trang và referrer policy. Thay CSP của trang tĩnh cũ bằng các chỉ thị `frame-ancestors`, `base-uri` và `form-action`, giữ bảo vệ tài liệu và cho script Next.js/media preview hoạt động. Chính sách nguồn script/media chi tiết cần được thiết kế riêng cùng nonce khi làm hardening.
- Mặc định chỉ mở `127.0.0.1:8080`. Để thử bằng điện thoại, đặt `WEB_BIND_ADDRESS=<IP mạng của máy>` trong `.env`, chạy `docker compose up -d --no-deps --wait nginx`, rồi dùng `http://<IP>:8080`. Chạy Next.js trên `0.0.0.0`; nếu firewall chặn kết nối, cần cho phép trên mạng đang dùng. Không đổi cấu hình publish MySQL/phpMyAdmin.
- HTTP này phục vụ phát triển với `pnpm dev`. Khi triển khai production sẽ cấu hình HTTPS phù hợp với cookie Secure.
- Nếu Nginx trả 502: kiểm tra Next.js cổng 3000 và kết nối từ container tới host. Sau khi đổi cổng publish/volume trong Compose cần tạo lại service; sửa nội dung config chỉ cần `nginx -t` rồi reload.

Nguồn: [Docker Desktop kết nối tới host](https://docs.docker.com/desktop/features/networking/networking-how-tos/), [Nginx WebSocket proxy](https://nginx.org/en/docs/http/websocket.html), [Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html).

## Kết quả kiểm tra 24/10/2026

Compose và `nginx -t` đạt; Nginx healthy. HTML, API kiểm tra DB, các API thay đổi dữ liệu cùng origin và kiểm tra từ chối origin giả đạt qua cổng 8080. WebSocket HMR `/_next/hmr` trả 101. Kiểm tra Chrome đăng nhập/đăng xuất và quay lại trang đã cache đạt, tài khoản kiểm thử đã được dọn. TypeScript và ESLint đạt. MySQL/phpMyAdmin giữ nguyên container đang chạy. Chưa xác nhận trực tiếp trên Safari iPhone hoặc cấu hình HTTPS production.
