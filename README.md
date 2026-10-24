# RecipeShare Club

Website chia sẻ công thức nấu ăn, đề 29. Hiện đã có nền Docker local, ứng dụng Next.js chính thức trong `app/` và cấu hình Drizzle cho MySQL. Đã tích hợp đăng nhập/đăng ký, bảng tin, editor, xuất bản và trang cá nhân với MySQL. Xem [checkpoint tích hợp](docs/integration-checkpoint.md) để biết phạm vi đã hoàn thành và các phần còn thiếu.

## Ứng dụng chính thức

Bản Docker production có frontend/API, migration, upload volume và Nginx HTTPS: [hướng dẫn chạy](docs/docker-production.md). Dev tiếp tục dùng `pnpm dev` như bên dưới. Tags được dùng làm danh mục; hỗ trợ tìm kiếm `#danh mục`, `@username`, `%nguyên liệu` và kết hợp nhiều điều kiện: [cú pháp tìm kiếm](docs/search.md).

`app/` dùng Next.js App Router, TypeScript, Tailwind và ESLint; mã nguồn nằm trong `app/src/`. `demo-ui/` là bản thử giao diện local, được Git bỏ qua.

```powershell
cd app
pnpm.cmd install
pnpm.cmd dev --port 3000
```

Mở http://localhost:8080 để sử dụng ứng dụng qua Nginx reverse proxy. Next.js vẫn chạy trực tiếp trên Windows ở cổng 3000 để giữ hot reload và debug; http://localhost:3000 vẫn dùng được khi cần kiểm tra trực tiếp. Xem [hướng dẫn reverse proxy](docs/nginx-development.md).

Các thư viện đã cài: `drizzle-orm`, `mysql2`, `dotenv`, `drizzle-kit`. `app/pnpm-workspace.yaml` cho phép script build của `esbuild`.

Tạo `app/.env.local` trên máy cho kết nối runtime:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=recipeshare
DB_USER=recipe_app
DB_PASSWORD="<mat-khau-runtime>"
```

Tạo riêng `app/.env.migration.local` cho Drizzle Kit:

```dotenv
MIGRATION_DB_HOST=127.0.0.1
MIGRATION_DB_PORT=3307
MIGRATION_DB_NAME=recipeshare
MIGRATION_DB_USER=recipe_owner
MIGRATION_DB_PASSWORD="<mat-khau-owner>"
```

Hai file này được Git bỏ qua. `drizzle.config.ts` đọc thông tin migration và trỏ tới `src/db/schema.ts`; schema và migration được lưu trong repository; migration mới nhất là `0007_author_management`. Sau khi cấu hình tài khoản migration, chạy `pnpm.cmd exec drizzle-kit migrate` trong `app/` để cập nhật database. Tài khoản `recipe_app` cần được tạo riêng với quyền `SELECT, INSERT, UPDATE, DELETE` trên `recipeshare.*`; Compose chưa tự tạo tài khoản này. Tài khoản `recipe_owner` dùng quản lý schema, không dùng làm tài khoản runtime.

Kiểm tra mã nguồn trong thư mục `app/`:

```powershell
pnpm.cmd exec tsc --noEmit
pnpm.cmd lint
```

## Chạy local

Cần Docker Desktop chạy **Linux containers**, Docker Compose và PowerShell. Từ thư mục dự án:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/init-local.ps1
docker compose config --quiet
docker compose up -d --wait
docker compose ps
```

Lệnh PowerShell trên chỉ áp dụng execution policy cho tiến trình chạy script, không đổi policy của máy. Script tạo `.env` và hai mật khẩu ngẫu nhiên trong `.secrets/`, không ghi đè file đã có. Các file này được Git bỏ qua. Compose secrets ở local là file mount, không phải kho secret mã hóa; chỉ chia sẻ file cấu hình mẫu.

- Ứng dụng qua Nginx: http://localhost:8080 (cần chạy Next.js ở cổng 3000).
- Nginx liveness: http://localhost:8080/health/live (không kiểm tra DB).
- phpMyAdmin: http://localhost:8081; server cố định là `mysql`.

Đăng nhập phpMyAdmin bằng user `recipe_owner` (hoặc `MYSQL_USER` trong `.env`). Đọc mật khẩu tại máy cá nhân bằng `Get-Content .secrets/mysql_owner_password.txt`. User này quản lý riêng database `recipeshare`, không phải tài khoản runtime của ứng dụng. Root dùng cho quản trị trong container, không dùng đăng nhập web.

Đổi cổng trong `.env` nếu 8080/8081 đã bị chiếm. MySQL publish `127.0.0.1:3307` tới cổng 3306 trong container để Next.js trên host kết nối. MySQL tham gia cả mạng `data` nội bộ và mạng `admin`. Mặc định các cổng bind localhost cho phát triển local. Có thể đặt `WEB_BIND_ADDRESS` thành IP mạng của máy để thử Nginx trên điện thoại; MySQL và phpMyAdmin vẫn bind localhost.

## Phạm vi nền hiện tại

- MySQL 8.4, database UTF-8, volume bền vững và healthcheck thực hiện `SELECT 1` bằng tài khoản có xác thực.
- phpMyAdmin chỉ khởi động sau khi MySQL healthy; không cấu hình tự đăng nhập.
- Nginx non-root, filesystem chỉ đọc, bỏ capabilities, security headers, reverse proxy tới Next.js trên host và healthcheck.
- Mạng dữ liệu nội bộ; log Docker xoay vòng tối đa 3 file × 10 MB mỗi service.

Nginx chuyển tiếp frontend và API tới `host.docker.internal:3000`, hỗ trợ streaming và WebSocket hot reload. Next.js chưa được đóng gói Docker. Prometheus + Grafana đã có dashboard tự nạp, metrics API/tiến trình và Nginx exporter. Xem [hướng dẫn giám sát](docs/monitoring.md) để đăng nhập và kiểm tra. Loki + Alloy thu log Nginx và sự kiện API/server Next.js; xem [hướng dẫn log và LogQL](docs/logging.md). Khi tạo lại Alloy, restart Nginx để cập nhật địa chỉ collector.

Image được ghim tag phiên bản; chưa ghim digest. Nguồn cấu hình: [MySQL official image](https://hub.docker.com/_/mysql), [phpMyAdmin official image](https://hub.docker.com/_/phpmyadmin), [Nginx unprivileged](https://hub.docker.com/r/nginxinc/nginx-unprivileged).

## Kiểm tra và vận hành

```powershell
Invoke-WebRequest http://localhost:8080/health/live
Invoke-WebRequest http://localhost:8081
docker compose exec mysql sh -c 'MYSQL_PWD="$(cat /run/secrets/mysql_owner_password)" mysql -h 127.0.0.1 -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT 1;"'
docker compose logs --tail 50
docker compose down
docker compose up -d --wait
```

`down` giữ volume MySQL. Không dùng `down -v` với dữ liệu cần giữ vì lệnh đó xóa volume. Mật khẩu và tên DB trong môi trường chỉ áp dụng lúc khởi tạo volume mới: sửa file secret không tự đổi mật khẩu DB đã có. Muốn đổi phải thực hiện đổi mật khẩu trong MySQL và đồng bộ file secret.

Khi báo không kết nối được Docker Engine, mở Docker Desktop và đợi Engine sẵn sàng rồi chạy lại. Khi có lỗi khởi tạo, xem `docker compose ps -a` và `docker compose logs mysql`; không xóa volume để thử lại khi có dữ liệu cần giữ.

Đã kiểm tra trên Docker Desktop Linux containers ngày 20/10/2026: Compose hợp lệ; cả ba service chạy; Nginx và MySQL healthy; website, liveness và phpMyAdmin trả HTTP 200; Nginx chạy UID 101 và trả security headers; DB không publish cổng, mạng data là internal. Bảng kiểm thử giữ nguyên một dòng sau restart/recreate và đã được dọn. Chưa kiểm thử luồng nghiệp vụ hoặc đăng nhập phpMyAdmin qua trình duyệt.

Cập nhật ngày 21/10/2026: đã kiểm tra Next.js trả HTTP 200 trên cổng 3001, đăng nhập phpMyAdmin, publish MySQL trên localhost:3307 và kết nối bằng Node.js/mysql2 với tài khoản `recipe_app`. Database nghiệp vụ vẫn trống. TypeScript và ESLint của `app/` kiểm tra thành công; chưa kiểm thử build production hoặc luồng xác thực.

Cập nhật 24/10/2026: đã chuyển Nginx từ trang tĩnh sang reverse proxy cho Next.js chạy trên Windows. Kiểm tra DB/API và đăng nhập/đăng xuất qua trình duyệt ở cổng 8080 đã đạt; các kiểm tra lịch sử bên trên mô tả trạng thái tại thời điểm tương ứng.

## Giám sát local

Grafana: http://localhost:3002/d/recipeshare-overview — user `admin`, mật khẩu local tại `.secrets/grafana_admin_password.txt`. Prometheus: http://localhost:9090. Chạy `scripts/init-local.ps1` để tạo secret và đồng bộ metrics token trước `docker compose up`. Xem [hướng dẫn và minh chứng](docs/monitoring.md). Next.js tiếp tục chạy trực tiếp trên máy để phát triển.

Dashboard MySQL/container: http://localhost:3002/d/recipeshare-infrastructure. Compose tự khởi tạo tài khoản MySQL `recipe_monitor` chỉ có USAGE; Telegraf thu CPU/RAM/network qua proxy Docker API giới hạn quyền. Xem [cấu hình, PromQL và kiểm thử](docs/infrastructure-monitoring.md). Service `mysql-monitor-setup` hoàn thành rồi thoát mã 0 là bình thường.
