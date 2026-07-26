'use client';

import type { RecommendedRecipe } from '@/types';

const NOPHOTO_GRADIENTS = [
  'linear-gradient(135deg, #f6e4d8, #efd9c8)',
  'linear-gradient(135deg, #eee6d0, #e6dcbf)',
  'linear-gradient(135deg, #e9edd9, #dee7c6)',
  'linear-gradient(135deg, #f2e1de, #ead1cb)',
];

function nameHashIndex(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return sum % NOPHOTO_GRADIENTS.length;
}

export function NoPhotoCard({
  name,
  onClick,
}: {
  name: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="nophoto"
      style={{
        width: 118,
        height: 120,
        flexShrink: 0,
        borderRadius: 10,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: NOPHOTO_GRADIENTS[nameHashIndex(name)],
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          opacity: 0.34,
          color: 'var(--tx)',
          textAlign: 'center',
          padding: '0 10px',
          letterSpacing: 1,
        }}
      >
        {name}
      </span>
      <span
        style={{
          position: 'absolute',
          bottom: 7,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 9.5,
          padding: '1.5px 8px',
          borderRadius: 99,
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          color: 'var(--tx2)',
          whiteSpace: 'nowrap',
          opacity: 0.9,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        📷 加照片
      </span>
    </div>
  );
}

export function NoPhotoCardSmall({ name }: { name: string }) {
  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: 10,
        flexShrink: 0,
        background: NOPHOTO_GRADIENTS[nameHashIndex(name)],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 800,
        color: 'var(--tx)',
        opacity: 0.4,
      }}
    >
      {name.slice(0, 2)}
    </div>
  );
}
