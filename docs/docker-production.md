# Chạy bản production bằng Docker Compose

Frontend và API cùng chạy trong service `app` (Next.js standalone). `compose.yaml` giữ workflow dev cũ; `compose.production.yaml` bổ sung ứng dụng, migration, volume upload và Nginx HTTPS.

## Khởi tạo

Cần Docker Desktop Linux containers, Node.js 24 và OpenSSL (script tự tìm bản đi kèm Git for Windows, hoặc đặt `OPENSSL_PATH`). Từ thư mục gốc:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/init-local.ps1
node scripts/init-production.mjs
Copy-Item .env.production.example .env.production.local
docker compose --env-file .env.production.local -f compose.yaml -f compose.production.yaml up -d --build --wait
```

Chỉ copy env mẫu khi chưa có `.env.production.local`. Mẫu dùng project `recipeshare-production`, cổng riêng với dev và volume database mới. Nếu cổng đã được một project kiểm thử sử dụng, chọn cổng trống trong file env; không xóa volume để xử lý xung đột.

- Ứng dụng: https://localhost:18443
- HTTP http://localhost:18080 chuyển sang HTTPS, trừ endpoint health của Nginx.
- phpMyAdmin: http://localhost:18081
- Grafana: http://localhost:13002
- Prometheus: http://localhost:19090

Chứng chỉ tự ký chỉ có SAN `localhost`, `127.0.0.1`, `::1`, được giữ trong `.secrets/tls/`. Script không cài chứng chỉ vào trust store của máy; trình duyệt cần tin cậy chứng chỉ này mới xác minh HTTPS bình thường. Kiểm thử dùng chính certificate làm CA, không tắt xác minh TLS.

## Dữ liệu và quyền

Compose chạy lần lượt: MySQL healthy → `app-db-setup` → `migrate` → `app` healthy → Nginx. Các service khởi tạo/migration kết thúc mã 0 là bình thường.

- `app-db-setup` dùng root secret trong container một lần để tạo `recipe_app` và cấp SELECT/INSERT/UPDATE/DELETE trên database ứng dụng.
- `migrate` dùng owner secret riêng, áp dụng lịch sử migration đã có, gồm danh hiệu mặc định. Không cần tài khoản ứng dụng có quyền sửa schema.
- `app` chạy user `node`, filesystem chỉ đọc; chỉ volume `/data/uploads` và các thư mục cache/tmp được ghi. Không publish cổng 3000 ra host.
- Mật khẩu runtime và token metrics được đọc từ Docker secrets lúc khởi động, không đóng vào image. Runtime không nhận owner/root secret.
- Session production giữ `Secure`, `HttpOnly`, `SameSite=Lax`. Truy cập ứng dụng qua HTTPS.
- `app_uploads` và `mysql_data` thuộc project Compose, giữ ảnh/dữ liệu qua restart/recreate.

Khi `mysql_app_password.txt` chưa có, script lấy mật khẩu runtime từ `app/.env.local` nếu đó là user `recipe_app`; nếu không có cấu hình runtime thì tạo mật khẩu ngẫu nhiên. File đã có được giữ nguyên. Không tự chuyển database hoặc upload của môi trường dev sang project production mới. Nếu dùng dữ liệu cũ, cần chuyển cả DB lẫn file upload tương ứng, không chỉ đổi tên project.

Image standalone loại `.env*`, upload local và source workspace khỏi runtime. Build giữ ESM boundary cùng dependency closure của `file-type`, bao gồm alias Turbopack của phiên bản Next.js hiện tại. Build không còn hai cảnh báo tracing media trước đây.

## Phát triển và cập nhật

Dev vẫn dùng Compose nền và Next.js trên máy:

```powershell
docker compose up -d --wait
cd app
pnpm.cmd dev --hostname 0.0.0.0 --port 3000
```

Production cập nhật bằng `up -d --build --wait` với đủ hai file Compose như trên. Sau khi tạo lại app hoặc Promtail, restart Nginx để phân giải lại địa chỉ upstream/syslog:

```powershell
docker compose --env-file .env.production.local -f compose.yaml -f compose.production.yaml restart nginx
```

Prometheus production scrape `app:3000/api/metrics` trong mạng Compose và có chín target, gồm Promtail. Log API gửi tới Alloy; log Nginx gửi riêng tới Promtail qua mạng container. Cả hai đẩy log vào Loki, không thu trùng; xem [cấu hình và kiểm chứng](logging.md). Các dashboard và cấu hình MySQL/container monitoring được giữ nguyên.

## Kiểm tra môi trường sạch

Tạo env riêng từ mẫu, đổi `COMPOSE_PROJECT_NAME` thành `recipeshare-clean-<tên-riêng>` và chọn các cổng trống. Chạy cùng hai file Compose để có volume mới, rồi:

```powershell
node scripts/test-production.mjs <duong-dan-env-rieng>
```

Script kiểm tra TLS, HTTP redirect, cookie Secure, origin guard, upload/xuất bản/tìm kiếm kết hợp, quyền runtime và image không có cấu hình local. Sau đó restart riêng MySQL, recreate app và xác nhận session/bài/ảnh còn nguyên; kiểm tra chín target metrics và log Nginx/Next.js đối chiếu theo request ID. Nó chỉ xóa fixture của tài khoản ngẫu nhiên do lượt kiểm thử tạo ra; giữ volume của project và không chạm project dev.

Lượt kiểm tra 25/10/2026 dùng project `recipeshare-clean-20261025`, env local ở `.tasks/production-clean.env`; các kiểm tra lifecycle đã đạt trước khi bổ sung Promtail. Project này sau đó đã nhận dữ liệu sử dụng thật; không coi volume là dữ liệu thử có thể xóa. Khi thêm Promtail, kiểm thử riêng `test-parallel-logging.mjs` và kiểm tra đọc bài/ảnh đã đạt mà không tạo hoặc sửa nội dung. Đây là hướng dẫn vận hành, chưa phải báo cáo đề tài hay bộ minh chứng trình bày.
