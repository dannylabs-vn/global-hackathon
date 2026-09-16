# Grow Career — Architecture Document

## Tổng quan dự án

Chrome Extension giúp người dùng đánh dấu (bookmark) các trang web họ thấy thú vị, tự động phân tích nội dung bằng AI để trích xuất chủ đề/lĩnh vực, rồi tổng hợp đề xuất career path phù hợp dựa trên lịch sử sở thích tích lũy theo thời gian. Ngoài ra, extension còn có tính năng highlight-to-explain: bôi đen từ khóa trên trang web bất kỳ để AI giải thích nhanh, và lưu lại thành flashcard để ôn tập.

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Extension | Chrome Manifest V3 (vanilla JS) |
| Dashboard | React + TypeScript (Vite) |
| Backend/DB/Auth | Supabase (PostgreSQL + Auth + Edge Functions) |
| AI | Google Gemini API (model: `gemini-2.5-flash`) |
| Hosting Edge Functions | Supabase Edge Functions (Deno runtime) |

## Luồng dữ liệu

```
[Content Script]                    [Background Service Worker]
  Chạy trong trang web      --(1)-->   Giữ session Supabase
  Trích xuất text (Readability)       Nhận message từ content script
                                       |
                                  (2) INSERT vào Supabase
                                       |
                                       v
                              [Supabase DB: bookmarks]
                                       |
                              (3) pg_net trigger (async)
                                       |
                                       v
                              [Edge Function: analyze-bookmark]
                                       |
                              (4) Gọi Gemini API
                                       |
                                       v
                              [Supabase DB: bookmark_analysis]
                                       |
                                       v
                              [Dashboard Web] đọc dữ liệu
                                       |
                              (5) User bấm "Phân tích Career"
                                       |
                                       v
                              [Edge Function: analyze-career]
                                       |
                              (6) Gọi Gemini API + mockData.json
                                       |
                                       v
                              [Supabase DB: career_reports]

[Highlight text trên trang web]
                                       |
                              (7) Ctrl+Shift+E → content-script hiện popup (Shadow DOM)
                                       |
                                       v
                              [Edge Function: explain-keyword]
                                       |
                              (8) Gọi Gemini API
                                       |
                                       v
                              Hiện giải thích trong popup
                                       |
                              (9) User bấm "Save to flashcard"
                                       |
                                       v
                              [Supabase DB: flashcards]
```

## Supabase Project

- **Project ref**: `kfdmduogwpgolhybqeez`
- **URL**: `https://kfdmduogwpgolhybqeez.supabase.co`
- **Region**: Asia-Pacific
- **RLS**: Bật tự động trên mọi bảng

### API Keys (dùng ở đâu)

| Key | Dùng ở | Lưu ý |
|---|---|---|
| `anon` (public) key | Extension, Dashboard, trigger pg_net | An toàn để public, RLS chặn quyền truy cập |
| `service_role` key | Chỉ trong Edge Functions | KHÔNG BAO GIỜ đưa vào extension hay dashboard |
| `GEMINI_API_KEY` | Chỉ trong Edge Functions (Supabase secrets) | KHÔNG BAO GIỜ đưa vào client code |

### Database Schema

```sql
-- Bảng 1: bookmarks (extension gửi lên)
create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  url text not null,
  title text,
  raw_text text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Bảng 2: bookmark_analysis (AI phân tích từng trang)
create table bookmark_analysis (
  id uuid primary key default gen_random_uuid(),
  bookmark_id uuid references bookmarks(id) not null,
  summary text,
  topics text[],
  domain_category text,
  technical_depth text,
  created_at timestamptz default now()
);

-- Bảng 3: career_reports (tổng hợp career path)
create table career_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  report_text text,
  top_topics text[],
  suggested_paths text[],
  created_at timestamptz default now()
);

-- Bảng 4: flashcards (lưu từ khóa đã giải thích từ tính năng highlight)
create table flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  keyword text not null,
  explanation text,
  source_url text,
  created_at timestamptz default now()
);
```

### RLS Policies (đã tạo)

- `bookmarks`: user chỉ đọc/ghi row có `user_id = auth.uid()`
- `bookmark_analysis`: user chỉ đọc row mà bookmark tương ứng thuộc về họ
- `career_reports`: user chỉ đọc/ghi row có `user_id = auth.uid()`
- `flashcards`: user chỉ đọc/ghi row có `user_id = auth.uid()`

### Database Trigger (đã tạo)

Khi INSERT vào `bookmarks` → trigger `on_bookmark_created` gọi Edge Function `analyze-bookmark` qua `pg_net` (bất đồng bộ). Extension KHÔNG cần gọi Edge Function — chỉ cần INSERT vào bookmarks, pipeline tự chạy.

### Edge Functions

**`analyze-bookmark`** ✅ (đã deploy, đang hoạt động):
- Nhận: `{ record: { id, raw_text } }`
- Gọi Gemini API (`gemini-2.5-flash`) với systemInstruction tách riêng, responseMimeType: "application/json"
- Insert kết quả vào `bookmark_analysis`
- Cập nhật `bookmarks.status` = "done" hoặc "failed"
- Dùng `service_role` key để bypass RLS

**`analyze-career`** ✅ (đã deploy, đang hoạt động):
- Được gọi từ Dashboard khi user bấm nút "Phân tích Career"
- Nhận: request có JWT token (user đã auth trên dashboard)
- Flow:
  1. Lấy user_id từ JWT token qua Supabase auth
  2. Query toàn bộ topics + domain_category + technical_depth từ bookmark_analysis của user
  3. Gửi Gemini prompt kèm: topics user + related_keywords từ mockData.json (CHỈ gửi id, name, related_keywords — không gửi toàn bộ skills để tiết kiệm token)
  4. Gemini trả JSON: top 5 ngách phù hợp nhất, mỗi ngách có: id, name, match_percent, match_reason
  5. Code Edge Function ghép skills từ mockData.json vào kết quả (dựa vào id ngách, không cần Gemini sinh skills)
  6. Lưu kết quả vào career_reports
- Dùng Gemini API (`gemini-3.6-flash`), giống pattern analyze-bookmark
- Dùng `service_role` key để query DB
- maxOutputTokens: 2048

**`explain-keyword`** ✅ (đã deploy, đang hoạt động):
- Được gọi trực tiếp từ Extension content script khi user highlight text + bấm Ctrl+Shift+E
- Nhận: `{ keyword: string, context?: string }`
- Gọi Gemini API (`gemini-3.6-flash`) với systemInstruction giải thích thuật ngữ ngắn gọn
- Trả JSON: `{ success, keyword, explanation, category, difficulty }` — KHÔNG insert DB, chỉ trả kết quả
- Có xử lý CORS (OPTIONS request) vì được gọi trực tiếp từ browser, khác các Edge Function khác chỉ gọi server-to-server
- Extension tự INSERT vào bảng `flashcards` khi user bấm "Save to flashcard" (không qua Edge Function)

## mockData.json — Dữ liệu 15 ngách IT

File `mockData.json` ở root project chứa 15 ngách IT định sẵn, mỗi ngách gồm:
- `id`: slug định danh (ví dụ: "frontend", "backend", "ml_ai")
- `name`: tên hiển thị
- `description`: mô tả chi tiết ngách
- `skills[]`: 10 skills theo thứ tự beginner → advanced, mỗi skill có order, name, level, description
- `related_keywords[]`: keyword để AI map topics user vào ngách

### 15 ngách:
1. `frontend` — Frontend Development
2. `backend` — Backend Development
3. `fullstack` — Full-Stack Development
4. `mobile` — Mobile Development
5. `devops` — DevOps / Cloud Engineering
6. `data_science` — Data Science / Analytics
7. `ml_ai` — Machine Learning / AI Engineering
8. `cybersecurity` — Cybersecurity
9. `game_dev` — Game Development
10. `embedded_iot` — Embedded / IoT
11. `blockchain` — Blockchain / Web3
12. `qa_testing` — QA / Testing Engineering
13. `sysadmin` — System / Network Administration
14. `database` — Database Engineering
15. `tech_lead` — Technical Leadership

### Cách AI dùng mockData:
```
Bước 1: Gửi Gemini CHỈ related_keywords + topics user
         → Gemini trả về: top 5 ngách (id, match_percent, match_reason)

Bước 2: Code Edge Function lấy skills từ mockData dựa vào id
         → Ghép thành kết quả hoàn chỉnh
```

### Format kết quả career analysis:
```json
{
  "niches": [
    {
      "id": "frontend",
      "name": "Frontend Development",
      "description": "Chuyên xây dựng giao diện người dùng...",
      "match_percent": 85,
      "match_reason": "Bạn quan tâm nhiều đến React, CSS, design system",
      "skills": [
        { "order": 1, "name": "HTML & CSS", "level": "beginner", "description": "..." }
      ]
    }
  ],
  "top_topics": ["react", "css", "distributed systems"],
  "analyzed_at": "2026-09-16T..."
}
```

## Chrome Extension ✅ (đã build xong)

### Design System — Modern Organic Light / Mint Paper Theme

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--brand` | `#087f70` | Nút chính, border focus |
| `--brand-deep` | `#075b51` | Hover state |
| `--ink` | `#123c36` | Chữ chính |
| `--muted` | `#5c706a` | Chữ phụ |
| `--mint` | `#e7f5ed` | Nền elevated/card |
| `--paper` | `#fbfcf7` | Nền chính |
| `--line` | `#dbe7de` | Border |
| Font | Inter | Toàn bộ |
| `--radius-md` | `12px` | Border-radius chuẩn |

### Luồng hoạt động — Save Bookmark

1. User bấm icon extension → popup hiện lên
2. Nếu chưa đăng nhập → form login/register (Supabase Auth)
3. Nếu đã đăng nhập → nút "Save This Page"
4. User bấm "Save This Page":
   - popup.js → background.js → inject content-script → trích xuất text
   - background.js INSERT vào Supabase bảng bookmarks
   - Pipeline AI tự chạy ngầm (trigger → analyze-bookmark → bookmark_analysis)

### Luồng hoạt động — Highlight to Explain ✅ (đã build xong)

1. User bôi đen text trên trang web bất kỳ
2. Bấm `Ctrl+Shift+E` (Windows) / `Cmd+Shift+E` (Mac)
3. `background.js` nhận command → gửi message tới content-script
4. `content-script.js` lấy text đã highlight + context xung quanh
5. Hiện popup nổi (Shadow DOM, cô lập CSS khỏi trang web) gần vị trí highlight
6. Gọi Edge Function `explain-keyword` → hiện giải thích + category + difficulty
7. User bấm "Save to flashcard" → INSERT vào bảng `flashcards`
8. Click ra ngoài popup → tự đóng

### Lưu ý: Supabase SDK trong Extension
- Service worker KHÔNG có `window` hay `localStorage`
- Supabase client dùng `chrome.storage.local` làm storage adapter

### Lưu ý: Shadow DOM cho popup highlight
- Popup highlight chạy trong content script, bị inject vào DOM của trang web bất kỳ → bắt buộc dùng Shadow DOM để cô lập CSS hoàn toàn
- CSS bên trong Shadow DOM dùng `:host { all: initial; }` để reset kế thừa từ trang web
- Màu sắc/font tái dùng đúng design tokens ở trên để đồng bộ với popup.html

## Dashboard Web (đang build)

### Tech: React + TypeScript + Vite

### Trang chính

1. **Login/Register** — Supabase Auth, cùng hệ thống auth với Extension
2. **Bookmark List** — title, url, topics, domain_category, status
3. **Interest Overview** — biểu đồ:
   - Phân bố domain_category
   - Top topics xuất hiện nhiều nhất
   - Timeline xu hướng sở thích theo thời gian
4. **Career Analysis**:
   - Nút "Phân tích Career Path" → gọi Edge Function `analyze-career`
   - Tổng quan: tên ngách + mô tả ngắn + % phù hợp
   - Chi tiết (bấm vào): mô tả ngách + lý do phù hợp + skills cần học (có thứ tự, có level)
   - Lịch sử reports trước đó
5. **Flashcards** (cân nhắc thêm) — danh sách từ khóa đã lưu từ tính năng highlight, dùng để ôn tập

### Kết nối Supabase

```javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, ANON_KEY);
```

### Gọi Edge Function từ Dashboard

```javascript
const { data, error } = await supabase.functions.invoke('analyze-career');
// JWT tự động gắn vào request
```

### Realtime (bonus)

```javascript
supabase
  .channel('bookmark-updates')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookmark_analysis' }, (payload) => {
    // Tự cập nhật UI khi AI phân tích xong
  })
  .subscribe();
```

## Thứ tự build

1. ✅ Supabase project + schema + RLS + trigger
2. ✅ Edge Function `analyze-bookmark`
3. ✅ Chrome Extension (save bookmark)
4. ✅ mockData.json (15 ngách IT)
5. ✅ Edge Function `analyze-career`
6. ✅ Bảng `flashcards` + Edge Function `explain-keyword`
7. ✅ Chrome Extension (highlight-to-explain, Shadow DOM popup)
8. ⬜ Dashboard (auth + bookmark list + charts + career analysis)
9. ⬜ Dashboard — trang Flashcards (tùy chọn)
10. ⬜ Realtime update (bonus)