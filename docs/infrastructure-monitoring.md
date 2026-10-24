# Giám sát MySQL và container

Phần này bổ sung phạm vi **container / web server / database** trong yêu cầu đề tài. Dashboard web/API cũ vẫn hoạt động; Next.js tiếp tục chạy trên Windows.

## Khởi chạy

Từ thư mục gốc:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/init-local.ps1
docker compose config --quiet
docker compose up -d --wait
docker compose restart nginx
```

Sau đó chạy Next.js từ `app/` bằng `pnpm.cmd dev --hostname 0.0.0.0 --port 3000` như trước. Restart Nginx sau khi tạo lại Alloy để cập nhật địa chỉ syslog, theo [hướng dẫn log](logging.md).

- Dashboard mới: http://localhost:3002/d/recipeshare-infrastructure
- Dashboard web/API: http://localhost:3002/d/recipeshare-overview
- Prometheus targets: http://localhost:9090/targets
- Prometheus alerts: http://localhost:9090/alerts

Đăng nhập Grafana bằng tài khoản cũ. Datasource/dashboard tự provision. Có tám scrape target: `prometheus`, `nginx`, `recipeshare`, `grafana`, `loki`, `alloy`, `mysql`, `containers`.

Script khởi tạo tạo hai file local bị Git bỏ qua: `.secrets/mysql_monitor_password.txt` và `.secrets/mysqld_exporter.cnf`. Không sửa hoặc chia sẻ nội dung các file này. Chạy lại script giữ secret đã có; nếu hai file không khớp, script dừng để đồng bộ tại máy.

## Nguồn số liệu

```text
MySQL :3306 → mysqld_exporter :9104 ─────────────────┐
Docker socket → proxy GET/HEAD :2375 → Telegraf :9273 ├→ Prometheus → Grafana
Nginx / Next.js / Loki / Alloy ──────────────────────┘
```

`mysql-monitor-setup` là service chạy một lần sau khi MySQL healthy. Nó dùng MySQL client, user hệ điều hành `mysql`, cùng network namespace của MySQL để xác thực `root@localhost`. Root password chỉ đọc từ secret trong initializer; exporter không nhận root password. Initializer tạo tài khoản DB `recipe_monitor` chỉ có **USAGE**, giới hạn tối đa ba kết nối. Nếu tên tài khoản đã tồn tại với quyền rộng hơn, initializer từ chối sử dụng; không tự thu hồi quyền của tài khoản đó. `mysql-exporter` chỉ khởi động sau khi initializer hoàn thành thành công.

Initializer **Exited (0)** là trạng thái bình thường. Tài khoản giám sát không có quyền đọc/ghi bảng ứng dụng. Exporter chỉ bật `global_status` và `global_variables`: tình trạng DB, uptime, connections, query counters, InnoDB buffer data... Không thu nội dung SQL, processlist, bảng người dùng hoặc số liệu replication. Những collector cần quyền cao hơn được tắt.

Telegraf dùng Docker Engine API để thu CPU, memory, network và trạng thái container. Nó chọn tên có prefix Compose project và kiểm tra label project chính xác; chỉ xuất hai label Compose project/service, không lấy biến môi trường làm nhãn. Chu kỳ thu/flush/scrape là 15 giây; số liệu đầu tiên có thể cần 30–60 giây để hiện đầy đủ. Samples cũ của Telegraf hết hạn sau 45 giây nếu không được cập nhật.

## Quyền Docker API

Chỉ `docker-metrics-proxy` mount `/var/run/docker.sock`, chạy user `nginx` (UID 101), bỏ capabilities, root filesystem chỉ đọc. Telegraf chạy user `telegraf`, không mount socket. Cả hai không chạy privileged, không mount root filesystem hay `/sys` của máy.

Proxy ở mạng riêng `docker_metrics` có `internal: true`; chỉ Telegraf và proxy tham gia. Không publish cổng 2375, 9273 hoặc 9104 ra host. Prometheus chỉ truy cập endpoint metrics qua mạng monitoring, không nằm trong mạng Docker API.

Mount socket `:ro` **không tự biến Docker API thành chỉ đọc**. Proxy thực thi allowlist GET/HEAD: `/_ping`, `/version`, `/info`, `/containers/json`, `/containers/<64-hex-id>/json` và `/containers/<id>/stats`, kể cả prefix phiên bản API. Những method/path khác bị trả 403, gồm create/exec/logs/archive/images.

Container inspect là API cần để đọc state/limits và cũng có thể trả cấu hình/env của container; do đó đây vẫn là thành phần có quyền đọc metadata nhạy cảm. Cấu hình Telegraf không xuất env và proxy chỉ dành cho collector tin cậy. Không mở mạng/cổng này cho ứng dụng hoặc máy ngoài.

Docker Desktop dùng socket GID 0. Nếu chạy trên Linux có GID khác, đặt `DOCKER_SOCKET_GID` trong `.env` bằng group ID của `/var/run/docker.sock`; không đổi quyền socket thành world-writable. Proxy được thêm đúng group để mở socket.

## Cách đọc dashboard và PromQL

Dashboard có bộ chọn Compose project. CPU/RAM/network là của **Linux containers trong Docker Desktop VM**; không phải toàn bộ tài nguyên Windows. Next.js chạy ngoài Docker nên vẫn xem CPU/RAM ứng dụng ở dashboard overview.

MySQL thực sự kết nối được:

```promql
mysql_up{job="mysql"}
```

`up{job="mysql"}` chỉ xác nhận scrape exporter; `mysql_up=1` xác nhận exporter kết nối MySQL. Xem hai chỉ số cùng nhau khi chẩn đoán mất DB hoặc sai credential.

Số truy vấn MySQL mỗi giây:

```promql
rate(mysql_global_status_queries{job="mysql"}[1m])
```

Bao gồm query của ứng dụng, healthcheck, exporter và thao tác quản trị; không phải số request web.

Tỉ lệ kết nối so với giới hạn:

```promql
100 * mysql_global_status_threads_connected{job="mysql"}
  / mysql_global_variables_max_connections{job="mysql"}
```

CPU từng container (thay tên project nếu khác):

```promql
docker_container_cpu_usage_percent{
  job="containers",com_docker_compose_project="recipeshare-club",cpu="cpu-total"
}
```

CPU là phần trăm do Docker tính: **100% tương đương một logical core**, có thể vượt 100% khi dùng nhiều core. Đây đã là gauge phần trăm, không bọc thêm `rate()`.

RAM từng container:

```promql
docker_container_mem_usage{job="containers",com_docker_compose_project="recipeshare-club"}
```

Chọn unit bytes. Số liệu là Docker memory usage và có thể gồm cache; `docker stats` CLI có thể trừ cache nên không nhất thiết bằng hệt. InnoDB buffer pool data là một chỉ số khác, không phải tổng RAM MySQL.

Network nhận mỗi giây:

```promql
rate(docker_container_net_rx_bytes{
  job="containers",com_docker_compose_project="recipeshare-club",network="total"
}[1m])
```

Đổi `rx_bytes` thành `tx_bytes` để xem gửi. Network tổng gồm mọi interface và cả traffic monitoring/DB/log. Dùng `rate` trước khi cộng nhiều series để xử lý counter reset. Bộ đếm/status là snapshot định kỳ; thay đổi state hoặc container vừa xóa có thể cần khoảng 45 giây mới hết samples cũ.

## Cảnh báo

Bổ sung ba rule, cùng ba rule web/API đã có:

- `MySqlUnavailable`: MySQL không kết nối được hoặc exporter không scrape được trong một phút.
- `ContainerMetricsUnavailable`: không scrape được Telegraf trong một phút.
- `ContainerStatsMissing`: Telegraf còn scrape được nhưng không có memory statistics trong một phút. Trường hợp này phân biệt collector HTTP còn sống với Docker API/thu thập bị hỏng.

Các rule hiển thị trong Prometheus Alerts; chưa gửi email/Alertmanager. Chưa có cảnh báo riêng cho mọi container bị dừng, CPU cao hay memory cao. Không suy ra toàn bộ ứng dụng healthy chỉ từ exporter up.

## Kiểm tra và minh chứng

```powershell
docker compose exec docker-metrics-proxy nginx -t
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose exec -w /etc/prometheus prometheus promtool test rules alerts.test.yml
node scripts/test-infrastructure-monitoring.mjs --evidence
node scripts/test-monitoring.mjs
node scripts/test-logging.mjs
```

Test infrastructure dùng tài khoản monitor để đọc `SHOW GRANTS`, kiểm tra không đọc được bảng ứng dụng, phát sinh `SELECT 1` và đợi counter MySQL tăng. Nó kiểm tra CPU/RAM/network/uptime cho từng service đang chạy, gather errors bằng 0, kiểm tra API proxy cho phép đọc cần thiết/chặn method và endpoint ngoài allowlist, quyền container và biểu thức dashboard qua Grafana. Không tạo tài khoản ứng dụng, bài viết hoặc sửa dữ liệu nghiệp vụ.

`--evidence` lưu snapshot metrics/kết quả kiểm tra tại [infrastructure-check.json](evidence/infrastructure-check.json), không ghi credential. Snapshot là số liệu tại thời điểm chạy, không thay thế dashboard live. Kiểm thử rule dùng series giả lập; không cần dừng MySQL để tạo lỗi.

Muốn minh họa khi trình bày: mở dashboard mới, tạo lượt xem/tìm kiếm qua cổng 8080, xem query/network thay đổi, mở Prometheus Targets và giải thích từng nguồn. Chụp phần MySQL, CPU/RAM và network vào báo cáo; tối thiểu ghi rõ tên metric, đơn vị và nguồn thu.

## Kết quả kiểm tra 24/10/2026

- MySQL exporter kết nối bằng tài khoản USAGE-only; đọc bảng ứng dụng bị từ chối. Counter queries tăng sau các truy vấn kiểm thử.
- Có CPU, RAM, network và uptime thật cho 11 service Compose đang chạy. Initializer đã chạy lại thành công và không sửa dữ liệu nghiệp vụ.
- Kiểm tra allowlist Docker API, user non-root, capabilities, filesystem và cổng publish của ba collector/proxy đều đạt. Hai file secret được Git bỏ qua.
- Dashboard infrastructure đã provision và toàn bộ 14 panel truy vấn được dữ liệu qua Grafana. Sau restart collector cần đợi chu kỳ gather/flush/scrape đầu tiên; kiểm thử đã tính khoảng chờ này.
- Tám target Prometheus up; cả sáu rule qua `promtool` và kiểm thử series giả. Hồi quy endpoint metrics bảo vệ và pipeline Loki/Alloy đạt.
- Snapshot minh chứng nằm ở `docs/evidence/infrastructure-check.json`. Phiên công cụ hiện tại không có browser khả dụng để chụp ảnh hoặc kiểm tra giao diện Grafana bằng mắt; chưa có screenshot dashboard mới.

Nguồn: [MySQL exporter v0.20.0](https://github.com/prometheus/mysqld_exporter/tree/v0.20.0), [Telegraf Docker input](https://github.com/influxdata/telegraf/tree/v1.39.3/plugins/inputs/docker), [Telegraf Prometheus output](https://github.com/influxdata/telegraf/tree/v1.39.3/plugins/outputs/prometheus_client).
