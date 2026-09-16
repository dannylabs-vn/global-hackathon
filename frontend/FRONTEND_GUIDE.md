# Frontend Integration Guide — Cho Claude Code

> Đọc file `ARCHITECTURE.md` và `mockData.json` trước khi thực hiện file này.

## Trạng thái hiện tại

### ✅ Backend đã hoàn tất — KHÔNG sửa gì thêm
- Supabase DB: 3 bảng (`bookmarks`, `bookmark_analysis`, `career_reports`) + RLS
- Edge Function `analyze-bookmark`: tự động chạy khi có bookmark mới
- Edge Function `analyze-career`: gọi từ dashboard, trả career analysis
- Database trigger: tự gọi `analyze-bookmark` khi INSERT vào `bookmarks`
- Chrome Extension: đã build xong, insert bookmark hoạt động

### ⬜ Frontend cần làm — NỘI DUNG FILE NÀY
- Tạo Supabase client
- Kết nối Auth (đăng nhập, đăng ký, bảo vệ route)
- Trang Bookmark List (đọc dữ liệu từ Supabase)
- Trang Interest Overview (biểu đồ từ dữ liệu bookmark_analysis)
- Trang Career Analysis (gọi Edge Function + hiển thị kết quả)

---

## Bước 1: Setup Supabase Client

Cài package:
```bash
npm install @supabase/supabase-js
```

Tạo file `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kfdmduogwpgolhybqeez.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmZG1kdW9nd3Bnb2xoeWJxZWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Nzg4OTQsImV4cCI6MjEwNTA1NDg5NH0.lnT7Fiii9mABkyze2OnLIZ9LMPojgkxv9YrUZjQ4Mnc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Quy tắc**: file này là nơi DUY NHẤT chứa URL và key. Mọi component import từ đây, KHÔNG hardcode key ở chỗ khác.

---

## Bước 2: Auth — Đăng nhập / Đăng ký / Bảo vệ route

### Tạo file `src/lib/auth.ts`:
```typescript
import { supabase } from './supabase';

// Đăng ký
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

// Đăng nhập
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

// Đăng xuất
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// Lấy session hiện tại (kiểm tra đã đăng nhập chưa)
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Lắng nghe thay đổi auth (đăng nhập/đăng xuất)
export function onAuthChange(callback: (session: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
```

### Bảo vệ route:
- Khi app load, gọi `getSession()` — nếu null thì redirect về trang Login
- Dùng `onAuthChange` để cập nhật UI real-time khi session thay đổi
- Mọi trang ngoài Login/Register đều cần user đã đăng nhập

---

## Bước 3: API Service — Gom tất cả hàm gọi Supabase

Tạo file `src/lib/api.ts`:
```typescript
import { supabase } from './supabase';

// ============================================
// BOOKMARKS
// ============================================

// Lấy danh sách bookmark + kết quả phân tích
// Tương đương: GET /api/bookmarks?include=analysis
export async function getBookmarks() {
  const { data, error } = await supabase
    .from('bookmarks')
    .select(`
      id,
      url,
      title,
      status,
      created_at,
      bookmark_analysis (
        summary,
        topics,
        domain_category,
        technical_depth
      )
    `)
    .order('created_at', { ascending: false });

  return { data, error };
}

// Response format:
// data = [
//   {
//     id: "uuid-string",
//     url: "https://example.com/article",
//     title: "Article Title",
//     status: "done" | "pending" | "failed",
//     created_at: "2026-09-16T10:30:00Z",
//     bookmark_analysis: [
//       {
//         summary: "This article discusses...",
//         topics: ["react", "css", "design system"],
//         domain_category: "web development",
//         technical_depth: "intermediate"
//       }
//     ]   // ← MẢNG, dù thực tế chỉ có 1 phần tử. Lấy [0] khi dùng.
//   }
// ]

// ============================================
// INTEREST OVERVIEW (dữ liệu cho biểu đồ)
// ============================================

// Lấy tất cả analysis để tổng hợp thống kê
// Tương đương: GET /api/analytics/overview
export async function getAnalyticsData() {
  const { data, error } = await supabase
    .from('bookmark_analysis')
    .select(`
      topics,
      domain_category,
      technical_depth,
      created_at,
      bookmarks!inner (user_id)
    `);

  return { data, error };
}

// Response format:
// data = [
//   {
//     topics: ["react", "hooks", "state management"],
//     domain_category: "web development",
//     technical_depth: "intermediate",
//     created_at: "2026-09-16T...",
//     bookmarks: { user_id: "uuid" }
//   }
// ]
//
// Xử lý phía frontend:
//
// 1. Đếm domain_category → pie/bar chart
//    const categoryCount: Record<string, number> = {};
//    data.forEach(item => {
//      const cat = item.domain_category || 'other';
//      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
//    });
//
// 2. Gom topics → đếm → sắp xếp → top 10
//    const topicCount: Record<string, number> = {};
//    data.forEach(item => {
//      item.topics?.forEach(topic => {
//        topicCount[topic] = (topicCount[topic] || 0) + 1;
//      });
//    });
//    const topTopics = Object.entries(topicCount)
//      .sort((a, b) => b[1] - a[1])
//      .slice(0, 10);

// ============================================
// CAREER ANALYSIS
// ============================================

// Gọi Edge Function phân tích career path
// Tương đương: POST /api/career/analyze
export async function analyzeCareer() {
  const { data, error } = await supabase.functions.invoke('analyze-career');

  return { data, error };
}

// Response format (từ Edge Function):
// data = {
//   niches: [
//     {
//       id: "frontend",
//       name: "Frontend Development",
//       description: "Chuyên xây dựng giao diện người dùng...",
//       match_percent: 85,
//       match_reason: "Bạn quan tâm nhiều đến React, CSS, design system",
//       skills: [
//         { order: 1, name: "HTML & CSS", level: "beginner", description: "..." },
//         { order: 2, name: "JavaScript", level: "beginner", description: "..." },
//         ...
//       ]
//     },
//     ... (top 5 ngách)
//   ],
//   top_topics: ["react", "css", "distributed systems"],
//   analyzed_at: "2026-09-16T10:30:00Z"
// }
//
// LƯU Ý: hàm này có thể mất 5-15 giây (chờ Gemini AI).
// Frontend CẦN hiện loading state khi gọi.

// Lấy lịch sử career reports
// Tương đương: GET /api/career/reports
export async function getCareerReports() {
  const { data, error } = await supabase
    .from('career_reports')
    .select('*')
    .order('created_at', { ascending: false });

  return { data, error };
}

// Response format:
// data = [
//   {
//     id: "uuid",
//     user_id: "uuid",
//     report_text: "{...}",  // JSON string — cần JSON.parse() khi dùng
//     top_topics: ["react", "css", "node.js"],
//     suggested_paths: ["Frontend Development", "Full-Stack Development"],
//     created_at: "2026-09-16T..."
//   }
// ]
// LƯU Ý: report_text là JSON STRING, không phải object.
// Cần parse: const reportData = JSON.parse(report.report_text);

// ============================================
// XÓAS BOOKMARK (nếu cần)
// ============================================

export async function deleteBookmark(id: string) {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', id);

  return { error };
}
```

---

## Bước 4: Kết nối từng trang

### 4.1 Trang Login/Register

Dùng `signIn()`, `signUp()` từ `auth.ts`.

Xử lý:
- Form có 2 field: email, password
- Nút "Đăng nhập" → gọi `signIn()` → nếu `error` thì hiện lỗi, nếu thành công thì redirect về trang chính
- Nút "Đăng ký" → gọi `signUp()` → thông báo kiểm tra email xác nhận (hoặc đăng nhập luôn tùy cấu hình Supabase)
- Nếu đã có session (check `getSession()`) → redirect thẳng về trang chính

### 4.2 Trang Bookmark List

```typescript
import { getBookmarks } from '@/lib/api';

// Trong component:
const [bookmarks, setBookmarks] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function load() {
    const { data, error } = await getBookmarks();
    if (!error) setBookmarks(data);
    setLoading(false);
  }
  load();
}, []);

// Render mỗi bookmark:
// - title (link tới url)
// - status: "done" = xanh, "pending" = vàng, "failed" = đỏ
// - topics: hiện dạng tag/chip (lấy từ bookmark.bookmark_analysis?.[0]?.topics)
// - domain_category: hiện dạng badge
// - created_at: format ngày tháng
```

### 4.3 Trang Interest Overview

```typescript
import { getAnalyticsData } from '@/lib/api';

// Gọi getAnalyticsData() rồi xử lý thành chart data
// Cần thư viện chart: recharts hoặc chart.js (chọn 1)
//
// Biểu đồ 1: Pie/Bar chart phân bố domain_category
// Biểu đồ 2: Bar chart horizontal top 10 topics
// Biểu đồ 3 (nếu kịp): Line chart số bookmark theo tuần/tháng
```

### 4.4 Trang Career Analysis

```typescript
import { analyzeCareer, getCareerReports } from '@/lib/api';

// State:
const [analyzing, setAnalyzing] = useState(false);
const [result, setResult] = useState(null);
const [history, setHistory] = useState([]);

// Load lịch sử reports khi vào trang:
useEffect(() => {
  async function load() {
    const { data } = await getCareerReports();
    if (data?.length > 0) {
      // Hiện report gần nhất
      setResult(JSON.parse(data[0].report_text));
    }
    setHistory(data || []);
  }
  load();
}, []);

// Khi user bấm nút "Phân tích Career Path":
async function handleAnalyze() {
  setAnalyzing(true);                          // hiện loading/spinner
  const { data, error } = await analyzeCareer();
  setAnalyzing(false);

  if (error) {
    // Hiện thông báo lỗi
    return;
  }
  setResult(data);                             // hiện kết quả mới
}

// Hiển thị kết quả:
// - Tổng quan: danh sách 5 ngách, mỗi ngách hiện name + match_percent (progress bar) + mô tả ngắn
// - Bấm vào 1 ngách → expand/modal hiện chi tiết:
//     + description (mô tả ngách)
//     + match_reason (lý do AI đánh giá phù hợp)
//     + skills[] (danh sách skill theo thứ tự, hiện level bằng badge màu)
```

---

## Quy tắc chung cho Claude Code

1. **Mọi gọi Supabase đều qua `src/lib/api.ts`** — component KHÔNG import supabase trực tiếp, chỉ import hàm từ api.ts
2. **Luôn check `error` trước khi dùng `data`** — pattern: `if (error) { hiện lỗi; return; }`
3. **`bookmark_analysis` là mảng** — luôn lấy `[0]` khi dùng: `bookmark.bookmark_analysis?.[0]`
4. **`report_text` là JSON string** — cần `JSON.parse()` trước khi dùng
5. **`analyzeCareer()` chậm (5-15 giây)** — BẮT BUỘC có loading state, không để UI đứng im
6. **KHÔNG dùng `service_role` key hay `GEMINI_API_KEY`** trong frontend — chỉ dùng `anon` key đã có trong supabase.ts
7. **RLS tự lọc dữ liệu theo user** — KHÔNG cần thêm `.eq('user_id', ...)` trong query, Supabase tự xử lý
8. **Auth session tự quản lý** — Supabase SDK tự refresh token, không cần code thêm logic refresh