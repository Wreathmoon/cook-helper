// @vitest-environment jsdom
//
// 守 antd 静态 message API 在 React 19 下能不能真的弹出来。
//
// 背景：antd v5 的 message.* 要从 react-dom 顶层取 createRoot/render 挂 holder，
// React 19 把两者都移到了 react-dom/client。缺补丁时 message.error() 会**静默失败**：
// 不抛错、不弹窗、生产环境无 console 警告。全项目 68 处调用会一起变哑，
// 而所有现有测试都是 node 环境的纯函数测试，一个都发现不了。
//
// 这个文件就是那个发现不了的缺口。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
// 静态导入：antd 体积大，首次 transform 要十几秒。放在模块层可以让这笔开销
// 落在模块加载阶段而不是单个用例的 testTimeout 里。
// 补丁必须排在 antd 之前——它靠 import 副作用调用 unstableSetRender。
import '@ant-design/v5-patch-for-react-19';
import { message } from 'antd';
import * as reactDom from 'react-dom';

const INSTRUMENTATION = path.join(process.cwd(), 'src/instrumentation-client.ts');

async function poll<T>(fn: () => T | null, timeoutMs = 2000): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const hit = fn();
    if (hit) return hit;
    if (Date.now() > deadline) return null;
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('antd 静态 message 在 React 19 下的可用性', () => {
  afterEach(() => {
    document.querySelectorAll('.ant-message').forEach((el) => el.remove());
  });

  it('react-dom 顶层确实没有 createRoot / render（补丁存在的前提）', () => {
    const keys = Object.keys(reactDom);
    // 若这条有一天失败了，说明 React 改回来了或降级了——
    // 那时才该重新评估补丁是否还需要，而不是直接删测试。
    expect(keys).not.toContain('createRoot');
    expect(keys).not.toContain('render');
  });

  it('instrumentation-client 引入了补丁（它在水合前执行）', () => {
    const src = readFileSync(INSTRUMENTATION, 'utf8');
    expect(src).toContain('@ant-design/v5-patch-for-react-19');
  });

  it('打了补丁后 message.error() 真的把节点挂进了 DOM', async () => {
    message.error('这是只读演示实例，改动不会被保存');

    // 需要至少两个宏任务：一个给 antd 内部延迟渲染，一个给 React 并发提交。
    // 轮询而不是猜一个固定延时——固定延时要么脆要么白等。
    const holder = await poll(() => document.querySelector('.ant-message'));
    expect(holder, 'message holder 没被挂载 —— 静态 message API 又哑了').not.toBeNull();
    expect(holder!.textContent).toContain('只读演示实例');
  });
});
