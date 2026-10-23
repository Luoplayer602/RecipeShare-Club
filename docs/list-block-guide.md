# Hướng dẫn tự thêm thẻ danh sách

Thẻ danh sách đã được nối hoàn chỉnh sau khi bổ sung schema/validation và sửa các nhánh còn thiếu trong editor, preview và trang đọc. Tài liệu dưới đây giữ lại các bước triển khai để tham khảo; không thêm nội dung hướng dẫn này vào giao diện.

## 1. Chốt dữ liệu dùng chung

Không lưu chuỗi HTML `<ul><li>…`. Lưu JSON gồm kiểu danh sách và nội dung các mục. Ví dụ:

```json
{
  "type": "list",
  "style": "decimal",
  "items": ["Rửa sạch nguyên liệu", "Làm nóng chảo"]
}
```

Các kiểu ban đầu:

| style | Hiển thị | Thẻ HTML |
| --- | --- | --- |
| disc | Chấm tròn đặc | ul |
| circle | Chấm tròn rỗng | ul |
| square | Ô vuông | ul |
| decimal | 1, 2, 3 | ol |
| lower-alpha | a, b, c | ol |
| upper-alpha | A, B, C | ol |
| lower-roman | i, ii, iii | ol |
| upper-roman | I, II, III | ol |

Trong `app/src/db/schema.ts`, thêm thành viên sau vào union `PostBlockData`:

```ts
  | {
      type: 'list'
      style: 'disc' | 'circle' | 'square' | 'decimal'
        | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman'
      items: string[]
    }
```

`post_blocks.data` hiện là cột JSON và không có enum loại thẻ trong MySQL, nên thay đổi này không cần thêm cột hay chạy migration SQL. `$type` chỉ giúp TypeScript; bước validation tiếp theo mới kiểm tra dữ liệu gửi lên.

## 2. Cho API chấp nhận list

Trong `app/src/lib/posts/editor-validation.ts`, thêm một `z.strictObject` vào mảng của `z.discriminatedUnion('type', …)`:

```ts
  z.strictObject({
    type: z.literal('list'),
    style: z.enum([
      'disc', 'circle', 'square', 'decimal',
      'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman',
    ]),
    items: z.array(z.string().trim().min(1).max(500)).max(100),
  }),
```

`items: []` được phép lưu nháp, giống đoạn văn còn trống. Các mục đã có nội dung giới hạn 500 ký tự, tối đa 100 mục. Không đặt giới hạn tối thiểu một mục ở schema lưu nháp.

Trong `app/src/lib/posts/publish-validation.ts`, thêm nhánh trước phần trả về image/video của `hasContent`:

```ts
if (block.type === 'list') {
  return block.items.some(item => item.trim().length > 0)
}
```

Một danh sách có nội dung được tính là nội dung bài viết. Danh sách trống không đủ để xuất bản. Không bỏ các điều kiện ảnh đại diện, mô tả và dữ liệu công thức đang có.

## 3. Kiểm tra luồng lưu và đọc hiện có

`save-draft.ts` đã lưu nguyên JSON từng block theo `position`; chỉ image/video mới được kiểm tra media. `publish-post.ts` cũng chỉ lấy tham chiếu media từ image/video và chụp snapshot dữ liệu nội dung. Không thêm nhánh ép list thành paragraph hoặc media.

Các route đọc dùng union `PostBlockData` sẽ nhận được list tự nhiên. Thứ tự trong mảng vẫn là thứ tự các mục; `position` là thứ tự thẻ trong bài.

Sau bước 1–2, TypeScript có thể báo lỗi tại chỗ render từng mặc định mọi thẻ còn lại là media. Cần hoàn thành bước 4–5 trước khi coi bản build là hoàn tất.

## 4. Nối vào editor

Sửa `app/src/components/editor/editor.tsx`:

1. Thêm `list` vào loại `Block`, tên `Danh sách` vào `blockLabels`, icon danh sách vào `blockIcons`.
2. Thêm trường `listStyle` dùng đúng union style ở trên. Khi tạo thẻ mới đặt `listStyle: 'disc'`. Cập nhật cả các nơi tạo object Block và đọc dữ liệu từ máy chủ.
3. Dùng trường `text` hiện có cho nội dung đang nhập, mỗi dòng một mục. Khi đọc block list từ API: `text = data.items.join('\n')` và `listStyle = data.style`.
4. Thêm nút `Danh sách` trong nhóm nút thêm thẻ, gọi `addBlock('list')`. Tiếp tục dùng `sortable.capture()` như các loại thẻ khác để giữ hiệu ứng thêm/xóa/đổi vị trí.
5. Trong thân thẻ list, thêm bộ chọn kiểu đánh dấu và `AutoTextarea` nhập các mục. Dùng dropdown có bo tròn và hoạt ảnh theo mẫu `HeadingLevelSelect`, mở rộng thành component riêng cho style.
6. Trong `persist`, xử lý list **trước** nhánh yêu cầu `block.src`/`mediaId`:

```ts
if (block.type === 'list') {
  blocks.push({
    type: 'list',
    style: block.listStyle,
    items: block.text.split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean),
  })
  continue
}
```

7. Khi xác định có nội dung trong checklist xuất bản và `previewPublication`, thêm list có ít nhất một dòng không trống. Đừng dùng `src` để xác định nội dung list.
8. Không giới hạn chỉ tổng chiều dài textarea: API vẫn kiểm tra số mục và chiều dài từng mục. Nếu vượt giới hạn, hiển thị thông báo tương ứng trước khi gửi.

## 5. Render thống nhất ở preview và trang đọc

Nên tạo `app/src/components/list-content.tsx` dùng chung để tránh hai nơi hiển thị khác nhau:

```tsx
import type { PostBlockData } from '@/db/schema'

type ListData = Extract<PostBlockData, { type: 'list' }>

export function ListContent({ data }: { data: ListData }) {
  if (!data.items.length) return null
  const List = ['disc', 'circle', 'square'].includes(data.style)
    ? 'ul' : 'ol'
  return (
    <List style={{ listStyleType: data.style }}>
      {data.items.map((item, index) => <li key={index}>{item}</li>)}
    </List>
  )
}
```

Ở `Preview` trong editor, chuyển `text` thành `items` như bước lưu rồi truyền vào component. Ở `app/src/components/community/post.tsx`, xử lý `data.type === 'list'` trước đoạn tìm `data.mediaId`.

CSS phải đặt lại `list-style-position: outside`, khoảng thụt lề và khoảng cách các mục, vì reset của Tailwind có thể loại bỏ dấu danh sách mặc định. Giữ màu và line-height cùng văn bản bài viết. Dùng nội dung React `{item}` để chữ được escape; không dùng `dangerouslySetInnerHTML`.

## 6. Kiểm tra trước khi chốt

- Lưu nháp rồi tải lại: giữ đúng style, nội dung và thứ tự mục.
- Đổi kiểu đánh dấu: preview và trang đọc hiển thị giống nhau.
- Thêm/xóa/kéo/đổi vị trí thẻ list vẫn có hoạt ảnh như paragraph.
- List trống lưu nháp được; bài chỉ có list trống chưa được xuất bản.
- Bài có list có nội dung, đủ ảnh/mô tả và điều kiện khác xuất bản được.
- API trả 422 cho style lạ, quá 100 mục, mục trống hoặc dài quá 500 ký tự.
- Chuỗi như `<script>…</script>` hiển thị như văn bản, không chạy mã.
- Bài cũ chứa heading/paragraph/image/video vẫn đọc và lưu bình thường.

Chạy trong thư mục `app` sau khi hoàn thành:

```powershell
pnpm.cmd exec tsc --noEmit
pnpm.cmd lint
pnpm.cmd build
```

Mở rộng `scripts/test-editor-integration.mjs` để gửi thêm list trong payload, kiểm tra đọc lại và xuất bản. Script hiện tạo tài khoản thử riêng và dọn dữ liệu sau khi chạy.
