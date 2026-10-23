# Integration checkpoint — 2026-10-23

## Branches

- `main` contains the production app, content/media backend and database migrations.
- `demo-ui` is an orphan branch containing the standalone demo at its repository root. It has no shared commit ancestry with `main`; do not merge it into `main`. Port selected components deliberately during integration.
- The local `demo-ui/` folder remains ignored on `main`. Local `demo-ui-worktree/` is an older upgrade worktree, not the new demo branch.
- No remote push is part of this checkpoint. Orphan ancestry prevents an ordinary merge, but is not an absolute prohibition against an explicit unrelated-history merge.

## Backend ready for integration

- Authentication: registration, login, database sessions, current user and logout.
- Recipe/blog drafts: create, author-only read/edit, validation and transactional saves.
- Publication: content validation, revision snapshot and publication timestamp.
- Public post list/detail with pagination, search, type and tag filters.
- Uploaded media and supported video URLs; authenticated/private or published/public file access, including byte ranges.
- Content migration `0003_add_content_tables` was applied and manually verified during development.

## Demo baseline

- Community home, saved/following views, full reader and recipe/blog block editor.
- Local fixtures: 36 posts, 10 per page; saved/followed state is browser-local.
- Desktop sidebar and mobile bottom navigation share navigation state.
- Editor supports ingredients, tags, media, drag sorting, draft storage and animated reading preview.
- Custom app logo/favicon; original cloche illustration retained on authentication forms.

## Validation at checkpoint

- `app`: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` passed.
- `demo-ui`: `pnpm exec tsc --noEmit` and `pnpm build` passed. The demo build configuration skips type checking, so the separate TypeScript check is required.
- Previous manual API checks covered draft permissions, rejected-write rollback, publication snapshots, upload type/size limits and byte-range responses. These were not rerun against the database for this commit.

## Open items

- Before Docker packaging, resolve both Turbopack dynamic filesystem tracing warnings in `app/src/lib/media/storage.ts` (`getUploadDirectory` and `getStoredFilePath`). Verify that uploads and the entire workspace are not unintentionally bundled; store uploaded files in a separate mounted volume.
- Retest authentication and interaction on the user's iPhone Safari 16.7.16 after restarting dev servers. LAN dev origins and touch-field font sizes were adjusted; device-level success is not yet confirmed.
- Pointer dragging, motion timing and mobile safe areas still need direct browser/device verification.
- Saved/following and other social interactions still need production APIs; demo controls must not be mistaken for completed backend integration.

## First integration target

Keep one complete path working: login → create recipe → upload media → save draft → publish → browse the public feed and reader. Use real sessions and API data while preserving the demo design baseline.


## Integration progress after checkpoint

Phase 1 ports the community frame, public feed and reader into `app`. These use real sessions and public post APIs; list responses include tags. Home supports 10-item pagination, title search and type/tag filters. Saved/following show unavailable states until their production APIs are implemented.


Phase 2 ports the protected `/editor/[id]` and enables draft creation from the community header. Recipe/blog drafts, image/video uploads, supported video URLs, manual saves, reload restoration and publication now use the production APIs. Editor/preview keep the demo motion and use the signed-in identity. Post type is selected at creation and remains fixed, matching the backend draft contract. Editor reads now include referenced media metadata behind the existing owner check.

Successful login waits for the existing closing/burst animation before navigation; reduced motion navigates immediately. Empty search/filter results enter with the feed fade/slide animation after loading finishes.

Validation: TypeScript, ESLint and production build passed. `node scripts/test-editor-integration.mjs` exercised real authentication, image upload, URL video registration, both draft types, save/reload media restoration, publish, public list/detail and unauthorized/incomplete/published-write guards. Its isolated account, posts, tags and files were removed afterward. Browser surfaces are unavailable in this session; visual motion and iPhone Safari behavior still need direct verification. The two previously recorded media tracing warnings remain.

The profile now provides the account draft list/resume entry point. Next: implement saved/following APIs before enabling those controls.


List-block integration now supports eight unordered/ordered marker styles across editor, persistence, preview and public reader. Existing schema/validation additions were preserved; missing UI serialization and rendering branches were completed. Integration tests cover all styles, list-only publication and rejected empty/invalid list content.


Selected parity updates: demo editor now includes list blocks, grouped adjacent images and shared exclusive video playback while retaining its local storage and fixtures. Demo creation opens the editor directly and empty results animate. Production pagination now follows the demo's scroll and outgoing/incoming card transitions with real API pagination. Both app builds and separate TypeScript checks passed; seeded demo reader/social fixtures were intentionally preserved.

Profile integration: aligned demo profile typography and ported the profile layout/navigation into production. Added migration 0004_user_profiles (applied locally), authenticated profile updates, owned image validation/public profile media, author post pagination/search and private draft listing/resume. Production has no simulated followers or local profile persistence. Both TypeScript checks, production build and real API lifecycle/security tests passed. Headless Chrome verified demo edit/upload/crop/resume and production public profile at 390px with no horizontal overflow or JavaScript/hydration errors. Direct iPhone Safari verification remains manual. Existing two media tracing warnings remain.

Sidebar navigation fix: home/profile now share the persistent (community) layout. Page-level CommunityFrame supplies shell settings without remounting the header/sidebar; loading stays within the content area. Production build, TypeScript/ESLint and headless production navigation checks passed for home/saved/following. Browser checks confirm the same header/nav DOM nodes and document survive transitions, with no console/hydration errors.

Dev instant validation follow-up: moved CommunityShellContext into its own client module. This removed the reproducible SSR undefined Provider error and the resulting instant UI validation failures in Turbopack dev. Headless Chrome on the existing dev server passed home/saved/following transitions with unchanged header/nav DOM and zero console errors; validation remains enabled.

Compact block dragging: all five editor block types now drag as their header, with a matching compact placeholder. Dropping animates expansion and shifts following cards/the add panel; returning to the original slot also expands. Applied the same sortable hook to production and demo. TypeScript/ESLint passed for production; browser pointer tests on demo covered all five block kinds, reordered expansion, no overlapping cards and cleared temporary heights, with no console errors.

Profile tab stability: preserve the results region height before changing tabs, keep the search section mounted, disable profile scroll anchoring and reserve a viewport-sized minimum with scroll-position allowance. The replacement results and region height animate when loading completes, respecting reduced motion. A delayed browser-only API fixture verified stable scrollTop and search coordinates on every animation frame when switching from ten posts to fewer drafts; no real records changed.

Loading/motion update: shared ChefLoader replaces visible loading text in streamed route fallbacks and community fetch states. Content progressively fades/slides in; the initial sidebar marker enters from the screen edge with overshoot, and AccountArea animates the guest login out while create/account controls enter when the real session arrives. Reduced motion is respected. Explicit sidebar/main/right-panel grid slots prevent the right panel filling the feed while streamed content is absent. Browser checks verified centered loader, real isolated login/session transition (account removed afterward), mobile width and reduced motion, plus four repeated refreshes with frame-by-frame column bounds and no console errors. TypeScript/ESLint and build passed; the two existing media tracing warnings remain.

Popup/editor loading follow-up: popup now starts and closes at the source button's exact width/height using independent transform scales. Replaced full-screen blur/filter animation with opacity-only dimming; in a three-cycle headless trace RasterTask count dropped from 4326 to 72, with the final run's median/p95 frame interval about 16.7 ms (environment-specific, not a device guarantee). Added generation/cancellation guards against an older close animation closing a newly reopened dialog. Browser checks passed exact popup/source geometry on desktop and 390px mobile, input limits, interrupted open/Escape, reduced motion and no console errors. Editor client data loading now uses the same centered ChefLoader as the server suspense boundary, and reveals the editor only after draft hydration. Delayed real-draft tests confirmed center coordinates and restoration at both viewport sizes; isolated accounts/drafts were removed.

Commit validation: full production ESLint and real editor/profile integration tests passed; deterministic image grouping/playback checks passed. Production build passed after the final editor loader and popup changes. Demo received a separate TypeScript check and production build before its independent snapshot. Local env files, uploads, build output and browser QA scratch files remain excluded.

Authentication navigation repair: consume and clear the successful-login flag/password before leaving the form. Complete-login/logout Server Actions invalidate auth-dependent navigation state and return to the public home; login re-emits the existing validated session cookie without extending its database expiration. Sidebar/menu link directly to the signed-in username's profile; guests go directly to login instead of caching a redirect from /profile. Profile component keys include viewer identity so owner state is reset when the session changes. Added scripts/test-auth-navigation.mjs for repeated real form login/logout, protected-profile navigation and document-preservation checks with isolated fixture cleanup (Chrome required).
Validation: full ESLint/build passed. The regression browser test passed against both dev and production, including logout from home and an owner profile, guest home browsing, login/profile clicks after logout, clearing the retained password, and three real UI logins without a document reload. Isolated users/sessions were removed. Windows may temporarily lock the Chrome test profile in the OS temp directory; this is separate from fixture/database cleanup. Existing two media tracing warnings remain.

### Lưu bài viết theo tài khoản
- Mang giao diện Đã lưu từ demo sang bản chính; dùng chung nút bookmark trong danh sách, hồ sơ và trang đọc, hỗ trợ khách chuyển tới đăng nhập.
- Migration `0005_saved_posts` đã áp dụng ở database phát triển: khóa kép người dùng/bài viết, xóa dây chuyền và index thứ tự lưu.
- API `GET /api/posts?saved=1`, `GET /api/saved-posts` (bộ đếm), `GET/PUT/DELETE /api/posts/[id]/save`; giới hạn theo phiên, chặn mutation khác origin, chỉ hiện bài published chưa xóa. PUT/DELETE idempotent.
- Danh sách mới lưu trước, tìm kiếm/lọc/phân trang, tự quay về trang còn dữ liệu khi bỏ bài cuối trang; giữ hiệu ứng trống/chuyển danh sách, đồng bộ bookmark và bộ đếm sau thao tác.
- Kiểm tra TypeScript, lint, production build đạt (hai cảnh báo tracing media có sẵn). `node scripts/test-saved-posts.mjs` đạt với hai tài khoản và dữ liệu cô lập tự dọn: quyền truy cập, origin, trùng lặp, thứ tự, tìm kiếm, phân trang, bài ẩn, bỏ lưu lặp lại.
- Kiểm thử Chrome thực tế đạt: lưu từ trang chủ, mở Đã lưu, vào trang đọc bỏ lưu, trở lại danh sách trống có hoạt ảnh; màn hình 390px không tràn ngang, không có lỗi JavaScript. Home được key theo phiên để không giữ danh sách riêng của tài khoản trước.

### Bộ lọc nhãn của Đã lưu
- Ẩn hàng lọc loại bài tại Đã lưu; tag phổ biến/số bài tính trên bộ sưu tập của tài khoản, độc lập trang/từ khóa/tag đang lọc.
- Nhấn thường chọn nhanh một tag; giữ 450ms (hoặc Shift + Enter/nhấn) ghim tag, kết hợp với các tag khác theo giao (bài có đủ mọi tag). Nhấn lại bỏ tag. Số lượng trượt ngang thành × khi ghim; hỗ trợ reduced motion.
- Hủy giữ khi kéo/vuốt quá 8px, pointer cancel hoặc rời nút; ngăn click tiếp sau long press. URL `tag` giữ tương thích cũ, `tags` chứa các tag ghim (tối đa 10), khôi phục khi reload/Back.
- Kiểm thử API đạt: đếm tag theo saved collection, loại tag chỉ có ở bài chưa lưu, lọc giao và giới hạn đầu vào. Kiểm thử Chrome cảm ứng 390px đạt: giữ hai tag, chuyển số → ×, vuốt không ghim, bỏ tag, reload và luồng lưu/bỏ lưu.

### Hành động trong trang đọc
- Sửa selector căn hàng actions để chỉ mô tả cộng đồng đẩy về trái, nút lưu sát chia sẻ trên desktop/mobile.
- Chia sẻ dùng AuthToast có sẵn, tự ẩn sau 4.5 giây, hiển thị lại khi nhấn tiếp; không thêm dòng vào nội dung bài.
- Avatar và tên tác giả dẫn đến `/profile/[username]`, hỗ trợ ảnh đại diện thật, hover/focus.
- TypeScript/lint đạt; Chrome 1440px và 390px đạt: khoảng cách hai nút, popup cố định không dịch nội dung, tự ẩn, liên kết hồ sơ tác giả, không tràn ngang/không lỗi JavaScript.

### Theo dõi tác giả (tích hợp bản chính)
- Migration `0006_user_follows` đã áp dụng ở database phát triển: khóa kép follower/author, FK cascade, index và CHECK cấm tự theo dõi.
- `GET/PUT/DELETE /api/profiles/[username]/follow`: trạng thái và số lượt thật; mutation yêu cầu phiên, kiểm tra origin, không tự theo dõi, thao tác idempotent. Trang cá nhân dùng chung FollowAuthor, hiển thị số người theo dõi/đang theo dõi; khách có liên kết đăng nhập.
- `GET /api/following`: danh sách riêng theo tài khoản, tìm theo tên/username, 5 bếp/trang, gợi ý tối đa 6 tác giả active có bài published, loại chính mình và các bếp đã theo dõi.
- `GET /api/posts?following=1`: chỉ bài published chưa xóa từ bếp active đã theo dõi, sắp theo publishedAt/id mới nhất trước, tìm theo tiêu đề/tác giả/nhãn, phân trang. Không cho kết hợp saved và following trong một request.
- Chuyển giao diện demo đã duyệt sang bản chính: bảng danh sách bếp đóng/mở, mở hồ sơ/bỏ theo dõi, feed 10 bài/trang, gợi ý bếp; giữ danh sách cũ khi tải và tự quay về trang hợp lệ khi bỏ theo dõi hết bài ở trang cuối. Sửa nhóm nút/bộ đếm trên profile mobile để không bị cắt ở cạnh phải.
- TypeScript/lint/production build đạt (hai cảnh báo tracing media cũ). `node scripts/test-following.mjs` và hồi quy saved-posts đạt: quyền, origin, tự/trùng theo dõi, tách tài khoản, tìm/phân trang danh sách, thứ tự feed, loại draft và tài khoản suspended.
- Chrome 1440px/390px đạt: từ bài đọc mở profile, theo dõi và tăng bộ đếm, vào feed, mở/đóng danh sách bếp, phân trang bài viết, bỏ theo dõi trên trang cuối trở về trạng thái trống, không lỗi JavaScript, nút profile mobile nằm trong viewport. Fixture được dọn sau mỗi lượt.
- Làm rõ bộ đếm profile thành hai cột số lớn; thêm followerCount thật vào danh sách/gợi ý bếp. API kiểm tra chỉ đếm follower active và fixture xác nhận mỗi bếp có đúng một lượt theo dõi.
- Đưa thống kê người theo dõi/đang theo dõi thành khu vực riêng dưới bio trong hồ sơ (cả chủ hồ sơ lẫn người xem); số liệu trả trực tiếp cùng API profile, cập nhật qua sự kiện theo dõi, bỏ hiển thị trùng trong cụm nút hành động.

### Tự rà soát trước khi commit theo dõi
- Đã sửa request trạng thái thừa trên mỗi thẻ bếp: dùng trạng thái đã biết từ directory; chỉ đọc lại khi focus/retry, và chỉ đồng bộ sự kiện liên quan cùng tác giả.
- Đánh số phiên request trạng thái để GET cũ không ghi đè follow/unfollow vừa hoàn tất; vô hiệu hóa GET đang chờ khi mutation/sự kiện mới xuất hiện. Profile refetch sau mutation để hủy snapshot bộ đếm cũ.
- Chrome kiểm thử giữ GET cũ, thực hiện follow rồi trả GET cũ: trạng thái mới được giữ. Kiểm tra API theo dõi và hồi quy saved-posts, TypeScript, lint, production build đều đạt; kiểm thử desktop/mobile 390px đạt. Không còn lỗi chặn commit được phát hiện trong phạm vi này.
- Giới hạn hiện tại: kiểm thử mobile bằng Chrome; Safari iPhone thực tế chưa được xác minh lại. Hai cảnh báo tracing media có sẵn vẫn để xử lý ở bước đóng gói triển khai.
