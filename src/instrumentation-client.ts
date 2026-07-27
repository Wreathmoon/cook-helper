// antd v5 的静态 message / notification / Modal API 内部要从 react-dom 顶层取
// createRoot 或 render 来挂载 holder，而 React 19 把两者都移走了（只剩
// react-dom/client）。结果是 message.error() 之类**静默失败**——不报错、不弹窗、
// 生产环境连 console 警告都没有（antd 那句兼容警告被 NODE_ENV 包着）。
//
// 这个补丁包把 antd 的 unstableSetRender 指向 react-dom/client 的 createRoot。
// 必须在任何 message.* 调用之前执行，所以放在 instrumentation-client——
// 它在 React 水合之前运行。
//
// 移除条件：升级到 antd v6（原生支持 React 19），届时连同依赖一起删掉。
import '@ant-design/v5-patch-for-react-19';
