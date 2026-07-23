'use client';

import { useState } from 'react';
import { Form, Input, Button, message, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signUp, verifyOtp } from '@/app/actions/auth';
import { TEXT } from '@/lib/constants/text';

const { Text } = Typography;

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [initLoading, setInitLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSendCode = async (values: { email: string; password: string }) => {
    setLoading(true);
    const { error } = await signUp({ email: values.email, password: values.password });
    setLoading(false);
    if (error) {
      message.error(`${TEXT.auth.registerFailed}：${error}`);
      return;
    }
    setEmail(values.email);
    setStep(1);
    message.success('验证码已发送 ✓');
  };

  const handleVerify = async () => {
    if (!otp || otp.length !== 8) {
      message.warning('请输入8位验证码');
      return;
    }
    setLoading(true);
    const { error } = await verifyOtp({ email, token: otp });
    setLoading(false);
    if (error) {
      message.error(`${TEXT.auth.verifyFailed}：${error}`);
      return;
    }

    // 初始化进度
    setStep(2);
    setInitLoading(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setInitLoading(false);
          message.success('厨房已准备就绪！');
          router.push('/recommend');
          return 100;
        }
        return p + 10;
      });
    }, 300);
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

        <div
          style={{
            width: 360,
            borderRadius: 14, background: 'var(--panel)',
            border: '1px solid var(--line)', padding: 24,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {step === 0 && (
            <Form form={form} layout="vertical" onFinish={handleSendCode}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginBottom: 16 }}>{TEXT.auth.registerTitle}</div>
              <Form.Item name="email" label={TEXT.auth.email} rules={[{ required: true, message: TEXT.auth.emailRequired }, { type: 'email', message: TEXT.auth.emailInvalid }]}>
                <Input placeholder={TEXT.auth.email} style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item name="password" label={TEXT.auth.password} rules={[{ required: true, message: TEXT.auth.passwordRequired }, { min: 6, message: TEXT.auth.passwordMin }]}>
                <Input.Password placeholder={TEXT.auth.password} style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item name="confirmPassword" label={TEXT.auth.confirmPassword} dependencies={['password']}
                rules={[{ required: true, message: TEXT.auth.confirmPasswordRequired },
                  ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) return Promise.resolve(); return Promise.reject(new Error(TEXT.auth.passwordMismatch)); } }),
                ]}
              >
                <Input.Password placeholder={TEXT.auth.confirmPassword} style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block loading={loading}
                  style={{ borderRadius: 10, height: 40, background: 'var(--primary-btn)', borderColor: 'var(--primary-btn)' }}
                >
                  {TEXT.auth.sendCode}
                </Button>
              </Form.Item>
            </Form>
          )}

          {step === 1 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginBottom: 12 }}>验证邮箱</div>
              <Text style={{ display: 'block', color: 'var(--tx2)', fontSize: 12, marginBottom: 16 }}>
                验证码已发送到 {email}
              </Text>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <Input.OTP length={8} value={otp} onChange={setOtp} size="large" />
              </div>
              <Button type="primary" onClick={handleVerify} block loading={loading} disabled={otp.length !== 8}
                style={{ borderRadius: 10, height: 40, background: 'var(--primary-btn)', borderColor: 'var(--primary-btn)' }}
              >
                {TEXT.auth.verify}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--tx)', marginBottom: 16 }}>
                正在为你准备厨房…
              </div>
              <div
                style={{
                  width: '100%', height: 8, borderRadius: 4,
                  background: 'var(--line)', overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progress}%`, height: '100%',
                    background: 'var(--primary-btn)',
                    borderRadius: 4, transition: 'width 0.3s',
                  }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--tx2)', marginTop: 8 }}>
                正在准备 54 道种子菜谱和常备调料…
              </div>
            </div>
          )}

          {step < 2 && (
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--tx2)' }}>
              {TEXT.auth.hasAccount} <Link href="/login" style={{ color: 'var(--primary)' }}>{TEXT.auth.goLogin}</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
