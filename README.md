# RecipeShare Club

Website chia sẻ công thức nấu ăn sử dụng Next.js, MySQL và Docker Compose. Có đăng ký/đăng nhập, công thức với nguyên liệu và danh mục, bản nháp, xuất bản, quản lý hồ sơ, lưu bài và theo dõi tác giả.

Toàn bộ giao diện, API, database, reverse proxy, giám sát và thu thập log chạy trong container. Luôn sử dụng đồng thời `compose.yaml` và `compose.production.yaml` trong các lệnh vận hành.

## Thành phần hệ thống

| Thành phần | Vai trò |
|---|---|
| Next.js standalone | Giao diện và API |
| MySQL 8.4 + phpMyAdmin | Lưu trữ và quản trị database |
| Nginx | Reverse proxy, HTTPS và security headers |
| Prometheus + Grafana | Thu thập metrics và hiển thị dashboard |
| MySQL exporter + Telegraf | Giám sát database và tài nguyên container |
| Loki + Promtail + Alloy | Promtail thu log Nginx, Alloy thu log Next.js, Loki lưu trữ log |

## Yêu cầu

- Docker Desktop chạy Linux containers, Docker Compose v2 hỗ trợ `--wait`.
- PowerShell; thực hiện các lệnh bên dưới tại thư mục gốc repository.
- Node.js 24 để chạy script khởi tạo cấu hình. Ứng dụng sử dụng Node.js bên trong image.
- OpenSSL trong PATH hoặc bản đi kèm Git for Windows; có thể đặt `OPENSSL_PATH` để chỉ định file thực thi.
- Kết nối Internet cho lần tải image và build đầu tiên.

## 1. Khởi tạo cấu hình và secrets

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/init-local.ps1
node scripts/init-production.mjs
```

Các script tạo mật khẩu ngẫu nhiên, token giám sát và chứng chỉ HTTPS tự ký trong `.secrets/`. File đã có được giữ nguyên. Tham số `ExecutionPolicy` chỉ áp dụng cho tiến trình PowerShell trên.

| File trong `.secrets/` | Mục đích |
|---|---|
| `mysql_root_password.txt` | Khởi tạo và quản trị MySQL trong container |
| `mysql_owner_password.txt` | Tài khoản quản lý schema và migration |
| `mysql_app_password.txt` | Tài khoản runtime `recipe_app` |
| `mysql_monitor_password.txt`, `mysqld_exporter.cnf` | Tài khoản giám sát `recipe_monitor` |
| `grafana_admin_password.txt` | Mật khẩu quản trị Grafana |
| `metrics_bearer_token.txt` | Bảo vệ endpoint metrics của ứng dụng |
| `tls/localhost.crt`, `tls/localhost.key` | Chứng chỉ và khóa riêng HTTPS |

Không đưa secrets, cấu hình riêng hoặc bản sao lưu dữ liệu lên Git. Compose secrets được mount từ file trên máy, không phải kho secrets mã hóa.

## 2. Cấu hình Docker Compose

**Với hệ thống đã có dữ liệu, tiếp tục dùng file env đang vận hành hoặc sao chép file đó sang `.env.production.local`. Giữ nguyên `COMPOSE_PROJECT_NAME` để sử dụng đúng volume hiện có.**

Với lần cài mới, tạo file cấu hình nếu chưa tồn tại:

```powershell
if (-not (Test-Path -LiteralPath .env.production.local)) {
    Copy-Item -LiteralPath .env.production.example -Destination .env.production.local
}
```

Nội dung mẫu:

```dotenv
COMPOSE_PROJECT_NAME=recipeshare-production
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=18080
HTTPS_PORT=18443
MYSQL_PORT=13307
PHPMYADMIN_PORT=18081
PROMETHEUS_PORT=19090
GRAFANA_PORT=13002
GRAFANA_ADMIN_USER=admin
SYSLOG_PORT=11514
MYSQL_DATABASE=recipeshare
MYSQL_USER=recipe_owner
DOCKER_SOCKET_GID=0
```

- `COMPOSE_PROJECT_NAME` xác định nhóm container, network và volume. Đổi tên sẽ chọn bộ volume khác, không tự chuyển dữ liệu.
- Các biến `*_PORT` là cổng trên máy. Đổi nếu bị chiếm; các container vẫn kết nối bằng tên service và cổng nội bộ.
- `MYSQL_USER` là tài khoản owner. Tài khoản ứng dụng `recipe_app` và giám sát `recipe_monitor` được tạo riêng.
- Giữ `WEB_BIND_ADDRESS=127.0.0.1` cho truy cập trên máy. Chứng chỉ mặc định chỉ có SAN `localhost`, `127.0.0.1`, `::1`; tên miền/IP khác cần chứng chỉ tương ứng.
- `DOCKER_SOCKET_GID` là group ID có quyền đọc Docker socket cho proxy metrics; mặc định `0` phù hợp cấu hình Docker Desktop đã kiểm tra.

Khai báo file env dùng xuyên suốt phiên terminal. Nếu giữ cấu hình ở vị trí khác, sửa `$composeEnv`:

```powershell
$composeEnv = '.env.production.local'
$composeArgs = @('--env-file', $composeEnv, '-f', 'compose.yaml', '-f', 'compose.production.yaml')
```

## 3. Build và khởi động

```powershell
docker compose @composeArgs config --quiet
docker compose @composeArgs up -d --build --wait
docker compose @composeArgs ps -a
```

Compose khởi động MySQL, tạo tài khoản runtime, áp dụng migration rồi chạy ứng dụng và Nginx. Các service `app-db-setup`, `mysql-monitor-setup`, `migrate` hoàn thành với trạng thái `Exited (0)` là bình thường.

Không cần cài dependencies hay chạy ứng dụng riêng trên máy. Image được build bằng Dockerfile nhiều giai đoạn; file upload lưu ở volume riêng.

## 4. Truy cập và đăng nhập

Các địa chỉ tương ứng cấu hình mẫu:

| Dịch vụ | Địa chỉ |
|---|---|
| Website | https://localhost:18443 |
| HTTP chuyển sang HTTPS | http://localhost:18080 |
| Nginx liveness | http://localhost:18080/health/live |
| phpMyAdmin | http://localhost:18081 |
| Grafana | http://localhost:13002 |
| Prometheus | http://localhost:19090 |

HTTPS mặc định dùng chứng chỉ tự ký nên trình duyệt có thể cảnh báo chưa tin cậy. Script không tự cài chứng chỉ vào kho tin cậy của hệ điều hành. Khi triển khai bằng tên miền, cấu hình chứng chỉ phù hợp do CA được tin cậy cấp. Cookie đăng nhập giữ `Secure`, `HttpOnly`, `SameSite=Lax`.

Website không có tài khoản mặc định: đăng ký mới hoặc đăng nhập bằng tài khoản đã có trong database.

phpMyAdmin kết nối tới server `mysql`; đăng nhập bằng `MYSQL_USER` và mật khẩu tại `.secrets/mysql_owner_password.txt`. Grafana dùng `GRAFANA_ADMIN_USER` và mật khẩu tại `.secrets/grafana_admin_password.txt`. Xem các file trực tiếp trên máy, không chia sẻ nội dung.

## 5. Giám sát và log

Dashboard được nạp tự động trong Grafana:

- Website và Nginx: `/d/recipeshare-overview`.
- MySQL và tài nguyên container: `/d/recipeshare-infrastructure`.
- Log tập trung: `/d/recipeshare-logs`.

Prometheus thu thập chín nhóm target: `prometheus`, `nginx`, `recipeshare`, `grafana`, `loki`, `alloy`, `promtail`, `mysql`, `containers`. Metrics ứng dụng được đọc qua `app:3000/api/metrics` trong mạng Compose; endpoint không được mở qua Nginx.

Trong Grafana Explore, chọn datasource **Loki** và khoảng thời gian có traffic. Ví dụ LogQL:

```logql
{service_name="nextjs"} | json
```

```logql
{service_name="nextjs"} | json | event="api_request" | status >= 500 | __error__=""
```

```logql
{service_name="nginx", kind="access"} | json | status >= 400 | __error__=""
```

Nginx chỉ gửi log access/error qua Promtail; Next.js chỉ gửi log qua Alloy. Cả hai chuyển log vào cùng Loki, gắn nhãn `collector="promtail"` hoặc `collector="alloy"` để phân biệt, không thu trùng nguồn. Nginx và API ghi request ID để đối chiếu sự kiện. Log API không ghi body, cookie, mật khẩu hoặc query string; Promtail che query trong log lỗi Nginx.

Promtail được giữ để đáp ứng thành phần trong đề thực hành; phần mềm đã hết hỗ trợ từ 02/03/2026. Cấu hình và cách kiểm chứng hai collector: [hướng dẫn log](docs/logging.md).

## 6. Cập nhật và vận hành

Sau khi cập nhật mã nguồn, sao lưu dữ liệu rồi chạy:

```powershell
docker compose @composeArgs up -d --build --wait
docker compose @composeArgs restart nginx
docker compose @composeArgs ps -a
```

Restart Nginx sau khi tạo lại `app` hoặc `promtail` để phân giải lại địa chỉ upstream và collector. Service `migrate` áp dụng migration chưa chạy trong quy trình khởi động/cập nhật.

Kiểm tra trạng thái và log:

```powershell
Invoke-WebRequest http://localhost:18080/health/live
docker compose @composeArgs logs --tail 100 app nginx mysql migrate
docker compose @composeArgs logs --tail 100 prometheus grafana promtail alloy loki
```

Liveness chỉ xác nhận Nginx đang chạy. Kiểm tra kết nối database qua `/api/health/db` trên website HTTPS. Nếu đã đổi cổng, thay địa chỉ tương ứng trong lệnh kiểm tra.

Dừng hoặc chạy lại hệ thống, giữ container và volume:

```powershell
docker compose @composeArgs stop
docker compose @composeArgs up -d --wait
```

Mở terminal mới cần khai báo lại `$composeEnv` và `$composeArgs` như bước 2.

## 7. Dữ liệu và bảo mật

- `mysql_data` lưu database; `app_uploads` lưu ảnh/video. Chuyển máy hoặc khôi phục cần xử lý cả hai để liên kết media còn đầy đủ.
- Sao lưu DB bằng `mysqldump` và sao lưu nội dung volume upload. Tạm ngừng thao tác ghi khi tạo bản sao lưu đồng bộ; giữ cả file env và secrets tương ứng ở nơi riêng an toàn.
- `docker compose @composeArgs down` giữ named volumes. Không thêm `-v` khi cần giữ dữ liệu; không xóa volume để xử lý lỗi khởi động hoặc xung đột cổng.
- Với DB đã khởi tạo, sửa file secret không tự đổi mật khẩu owner/root. Cần đồng bộ thay đổi trong MySQL và file secret.
- App chạy non-root, filesystem chỉ đọc ngoài upload/cache/tmp, bỏ capabilities và bật `no-new-privileges`. Runtime DB chỉ có quyền dữ liệu, không sử dụng owner/root.
- MySQL dùng mạng dữ liệu nội bộ. Các cổng quản trị bind localhost; app không publish cổng 3000. Proxy Docker API cho metrics chỉ cho phép các API đọc đã giới hạn.
- Không có dữ liệu nghiệp vụ mẫu được nạp tự động; migration khởi tạo schema và danh hiệu mặc định.

## Xử lý lỗi thường gặp

| Hiện tượng | Cách kiểm tra |
|---|---|
| Không kết nối được Docker Engine | Mở Docker Desktop, chọn Linux containers và đợi Engine sẵn sàng |
| Cổng đã được sử dụng | Sửa cổng trong file env đang dùng rồi chạy lại Compose |
| Website trả 502 sau recreate | Kiểm tra app healthy và restart Nginx |
| Không thấy dữ liệu cũ | Kiểm tra đúng file env và `COMPOSE_PROJECT_NAME`; không xóa hoặc khởi tạo lại volume |
| Migration hoặc khởi tạo thất bại | Xem `ps -a`, log `mysql`, `app-db-setup`, `migrate`; kiểm tra secrets khớp DB |
| Chrome báo chứng chỉ chưa tin cậy | Kiểm tra chứng chỉ tự ký, hostname, thời hạn; cấu hình trust hoặc chứng chỉ phù hợp trên máy triển khai |
| Thiếu metrics hoặc log | Kiểm tra Prometheus Targets, datasource Grafana, log exporter/Promtail/Alloy/Loki và khoảng thời gian truy vấn |
