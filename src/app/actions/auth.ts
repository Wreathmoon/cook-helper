'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { initUserFromSeed } from '@/lib/services/seed/initUser';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * 注册：创建用户 + 发送 OTP 到邮箱
 */
export async function signUp(formData: { email: string; password: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
  });
  if (error) return { error: error.message, data: null };
  return { data, error: null };
}

/**
 * 验证 OTP（6位数字验证码）
 */
export async function verifyOtp(formData: { email: string; token: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: formData.email,
    token: formData.token,
    type: 'signup',
  });
  if (error) return { error: error.message, data: null };

  // 验证成功后，初始化种子数据
  if (data.user) {
    const serviceRole = createServiceRoleClient();
    await initUserFromSeed(serviceRole, data.user.id);
  }

  return { data, error: null };
}

/**
 * 登录
 */
export async function signIn(formData: { email: string; password: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });
  if (error) return { error: error.message, data: null };
  revalidatePath('/', 'layout');
  return { data, error: null };
}

/**
 * 登出
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/demo');
}
