/**
 * AI 录入的固定文案 —— 服务端和客户端都要用，所以单独放一份
 * （跟 `src/lib/memory/text.ts` 同一个道理：`READ_ONLY_TIP` 住在
 * `'use client'` 的 provider 里，服务端 action 不该去那边 import）。
 */

/** 只读沙盒下的拒绝理由。**拦在发请求之前**，不烧 token */
export const READ_ONLY_MESSAGE =
  '这是只读演示实例，AI 录入不可用（它会真的花钱调模型，而改动又不会被保存）。想自己用的话，把仓库 clone 到本地跑一份。';

/** 没配好时，按钮旁边那句话 */
export const NOT_CONFIGURED_LABEL = '未配置 —— 点击查看要配什么';

/** 新食材分区的说明 */
export const FRESH_HINT = '这些还不在你的库存里。确认分类后会新增；不想要的可以逐条去掉。';

/** 撤销条 */
export const UNDO_LABEL = '刚刚录入的内容可以撤销';
