export type StatusDotStatus = 'good' | 'warn' | 'bad' | 'notice';

const STATUS_CLASS: Record<StatusDotStatus, string> = {
  good: 'dot-g',
  warn: 'dot-y',
  bad: 'dot-r',
  notice: 'dot-o',
};

export function StatusDot({
  status,
  size = 8,
}: {
  status: StatusDotStatus;
  size?: number;
}) {
  return (
    <span
      className={`status-dot ${STATUS_CLASS[status]}`}
      style={{ width: size, height: size }}
    />
  );
}
