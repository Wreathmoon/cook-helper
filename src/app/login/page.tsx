'use client';

import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from '@/app/actions/auth';
import { TEXT } from '@/lib/constants/text';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    const { error } = await signIn({ email: values.email, password: values.password });
    setLoading(false);
    if (error) {
      message.error(`${TEXT.auth.loginFailed}：${error}`);
      return;
    }
    message.success(TEXT.auth.loginSuccess);
    router.push('/recommend');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(165deg, var(--primary-soft), var(--bg) 55%)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 400 }}>
        {/* Logo */}
        <div
          style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--logo-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 16, fontWeight: 700,
          }}
        >
          CH
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx)' }}>
            家里有什么 <span style={{ color: 'var(--primary)' }}>→</span> 能做什么 <span style={{ color: 'var(--primary)' }}>→</span> 该买什么
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 6 }}>家庭厨房智能助手</div>
        </div>

        <div
          style={{
            width: 360,
            borderRadius: 14, background: 'var(--panel)',
            border: '1px solid var(--line)', padding: 24,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div
            style={{
              display: 'flex', gap: 4, padding: 4, marginBottom: 20,
              borderRadius: 'var(--radius-segmented)', background: 'var(--hover)',
            }}
          >
            <button
              type="button"
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
                background: 'var(--panel)', color: 'var(--primary)',
                fontWeight: 700, fontSize: 13, cursor: 'default',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {TEXT.auth.login}
            </button>
            <button
              type="button"
              onClick={() => router.push('/register')}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
                background: 'transparent', color: 'var(--tx2)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              {TEXT.auth.register}
            </button>
          </div>
          <Form layout="vertical" onFinish={handleLogin}>
            <Form.Item name="email" label={TEXT.auth.email} rules={[{ required: true, message: TEXT.auth.emailRequired }, { type: 'email', message: TEXT.auth.emailInvalid }]}>
              <Input placeholder={TEXT.auth.email} style={{ borderRadius: 10 }} />
            </Form.Item>
            <Form.Item name="password" label={TEXT.auth.password} rules={[{ required: true, message: TEXT.auth.passwordRequired }]}>
              <Input.Password placeholder={TEXT.auth.password} style={{ borderRadius: 10 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}
                style={{ borderRadius: 10, height: 40, background: 'var(--primary-btn)', borderColor: 'var(--primary-btn)' }}
              >
                {TEXT.auth.login}
              </Button>
            </Form.Item>
          </Form>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--tx2)' }}>
            {TEXT.auth.noAccount} <Link href="/register" style={{ color: 'var(--primary)' }}>{TEXT.auth.goRegister}</Link>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Link href="/demo" style={{ fontSize: 12, color: 'var(--tx2)', textDecoration: 'underline' }}>先逛逛只读 Demo</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
