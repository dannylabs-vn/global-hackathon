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
//    const categoryCount = {};
//    data.forEach(item => {
//      const cat = item.domain_category || 'other';
//      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
//    });
//
// 2. Gom topics → đếm → sắp xếp → top 10
//    const topicCount = {};
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
// XÓA BOOKMARK (nếu cần)
// ============================================

export async function deleteBookmark(id) {
  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', id);

  return { error };
}

// ============================================
// FLASHCARDS (tính năng highlight-to-explain)
// ============================================

// Lấy danh sách flashcard đã lưu từ tính năng highlight trên extension
export async function getFlashcards() {
  const { data, error } = await supabase
    .from('flashcards')
    .select('id, keyword, explanation, source_url, created_at')
    .order('created_at', { ascending: false });

  return { data, error };
}

// Response format:
// data = [
//   {
//     id: "uuid",
//     keyword: "idempotent",
//     explanation: "An operation that produces the same result...",
//     source_url: "https://example.com/article",
//     created_at: "2026-09-17T10:30:00Z"
//   }
// ]
