# Tìm kiếm và danh mục

Tags hiện được dùng làm danh mục; giữ nguyên bảng `tags`/`post_tags` và dữ liệu đã có. Không tạo hệ thống phân loại thứ hai.

| Cú pháp | Kết quả |
|---|---|
| `canh nấm` | Bài viết có tiêu đề phù hợp |
| `#món chay` | Bài thuộc danh mục/tag phù hợp |
| `@minhan` | Popup người dùng có username phù hợp, liên kết đến hồ sơ |
| `%nấm hương` | Công thức có tên nguyên liệu phù hợp |
| `@minhan #món chay %nấm` | Bài của username phù hợp, thuộc danh mục phù hợp và có nguyên liệu phù hợp |

Các điều kiện kết hợp bằng AND. Mỗi cụm có thể chứa dấu cách và kết thúc khi gặp ký hiệu tiếp theo có khoảng trắng phía trước. Tìm theo chuỗi con, không phân biệt hoa/thường theo quy tắc dữ liệu hiện tại; nhiều `#` hoặc `%` phải cùng được thỏa mãn. Có thể thêm từ khóa tiêu đề trước các ký hiệu.

Khi chỉ dùng `@`, popup hiển thị tối đa tám người dùng active, không trả email/phone/password; thêm ký tự nếu còn nhiều kết quả. Ký hiệu chưa có nội dung như `@` hoặc `%` không mở tìm kiếm toàn bộ dữ liệu. Giới hạn 300 ký tự và tối đa mười ký hiệu/lần tìm.

Request chờ 400 ms sau lần gõ cuối; timer/request cũ được hủy khi thay đổi từ khóa. Kết quả người dùng được gắn với từ khóa tương ứng để response cũ không ghi đè danh sách mới. Popup hỗ trợ phím lên/xuống, Enter, Escape và liên kết hồ sơ; nút tròn `?` mở hướng dẫn khi hover/focus hoặc chạm. Hoạt ảnh opacity/translate/scale mở và đóng theo phong cách menu hiện có; tắt transition khi người dùng chọn giảm chuyển động.

Kiểm tra từ `app/`:

```powershell
node scripts/test-search.mjs
node scripts/test-search-integration.mjs
```

Integration test tạo fixture riêng và tự dọn, kiểm tra tìm kiếm kết hợp, danh mục nhiều từ, nguyên liệu, draft không công khai, chuỗi SQL được coi là dữ liệu và quyền riêng tư kết quả người dùng. Luồng production cũng được kiểm tra bằng `scripts/test-production.mjs`.

Kiểm tra trực tiếp Chrome ngày 25/10/2026: `@user` mở danh sách tối đa tám kết quả; phím lên/xuống, Enter mở hồ sơ, Escape đóng và xóa tìm kiếm hoạt động. `@` thiếu username và username không tồn tại có thông báo riêng. `@user3 #món chính %gà` trả đúng một bài trong dữ liệu dev. Popup hướng dẫn hiển thị đúng tiếng Việt, không tràn ngang ở viewport 390×844 và 320×640; kích thước trình duyệt được khôi phục sau kiểm tra. Console không ghi nhận lỗi trong lượt thử. Mở/đóng bằng click và bàn phím đã được kiểm chứng bằng công cụ; người dùng trực tiếp xác nhận đường rê chuột từ nút sang popup giữ mở, rê ra đóng đúng và hoạt ảnh mượt.
