'use client';

import React, { useState } from 'react';
import { Card, Form, Input, Button, message } from 'antd';
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
    <Card
      title={TEXT.auth.loginTitle}
      style={{ maxWidth: 400, margin: '100px auto' }}
    >
      <Form layout="vertical" onFinish={handleLogin}>
        <Form.Item
          name="email"
          label={TEXT.auth.email}
          rules={[
            { required: true, message: TEXT.auth.emailRequired },
            { type: 'email', message: TEXT.auth.emailInvalid },
          ]}
        >
          <Input placeholder={TEXT.auth.email} />
        </Form.Item>

        <Form.Item
          name="password"
          label={TEXT.auth.password}
          rules={[
            { required: true, message: TEXT.auth.passwordRequired },
          ]}
        >
          <Input.Password placeholder={TEXT.auth.password} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {TEXT.auth.login}
          </Button>
        </Form.Item>
      </Form>

      <div style={{ textAlign: 'center' }}>
        {TEXT.auth.noAccount}
        <Link href="/register">{TEXT.auth.goRegister}</Link>
      </div>
    </Card>
  );
}
