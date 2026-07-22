'use client';

import React, { useState } from 'react';
import { Card, Steps, Form, Input, Button, message, Typography } from 'antd';
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
    message.success(TEXT.auth.sendCode + ' ✓');
  };

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      message.warning(TEXT.auth.otpRequired);
      return;
    }
    setLoading(true);
    const { error } = await verifyOtp({ email, token: otp });
    setLoading(false);
    if (error) {
      message.error(`${TEXT.auth.verifyFailed}：${error}`);
      return;
    }

    // TODO: Task 7 实现种子复制 service
    // import { initUserFromSeed } from '@/lib/services/seed/initUser';
    // await initUserFromSeed(user.id);

    message.success(TEXT.auth.registerSuccess);
    router.push('/recommend');
  };

  return (
    <Card
      title={TEXT.auth.registerTitle}
      style={{ maxWidth: 400, margin: '100px auto' }}
    >
      <Steps
        current={step}
        style={{ marginBottom: 24 }}
        items={[
          { title: TEXT.auth.fillInfo },
          { title: TEXT.auth.verifyEmail },
        ]}
      />

      {step === 0 ? (
        <Form form={form} layout="vertical" onFinish={handleSendCode}>
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
              { min: 6, message: TEXT.auth.passwordMin },
            ]}
          >
            <Input.Password placeholder={TEXT.auth.password} />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label={TEXT.auth.confirmPassword}
            dependencies={['password']}
            rules={[
              { required: true, message: TEXT.auth.confirmPasswordRequired },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(TEXT.auth.passwordMismatch));
                },
              }),
            ]}
          >
            <Input.Password placeholder={TEXT.auth.confirmPassword} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {TEXT.auth.sendCode}
            </Button>
          </Form.Item>
        </Form>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <Text style={{ display: 'block', marginBottom: 16 }}>
            {TEXT.auth.codeSentTo.replace('{email}', email)}
          </Text>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <Input.OTP
              length={6}
              value={otp}
              onChange={setOtp}
            />
          </div>
          <Button
            type="primary"
            onClick={handleVerify}
            block
            loading={loading}
            disabled={otp.length !== 6}
          >
            {TEXT.auth.verify}
          </Button>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        {TEXT.auth.hasAccount}
        <Link href="/login">{TEXT.auth.goLogin}</Link>
      </div>
    </Card>
  );
}
