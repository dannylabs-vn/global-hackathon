import { supabase } from './supabase';

// Đăng ký
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

// Đăng nhập
export async function signIn(email, password) {
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
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
}
