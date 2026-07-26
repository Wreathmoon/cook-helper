'use client';

import type { ShoppingListItem } from '@/types';

export function ShoppingPanel({
  items,
  checkedIds,
  onToggle,
  onCheckout,
  checkoutLoading,
  loading,
}: {
  items: ShoppingListItem[];
  checkedIds: Set<string>;
  onToggle: (key: string) => void;
  onCheckout: () => void;
  checkoutLoading: boolean;
  loading: boolean;
}) {
  // 参考价是可选的，所以合计只是「有价那部分的合计」，并把覆盖率一并说清楚，
  // 免得看着一个偏低的数字以为这就是全部要花的钱
  const pricedItems = items.filter((item) => typeof item.price === 'number');
  const estimatedTotal = pricedItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const pricedCount = pricedItems.length;

  if (loading) {
    return (
      <div className="card shoplist" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 14 }}>🛒 购物清单</b>
        </div>
        <div className="sub" style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
          勾选的菜缺什么 + 库存告急的常备项；打勾 = 已买到，库存自动改「充足」
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="sk-shimmer" style={{ height: 48, borderRadius: 8 }} />
          <div className="sk-shimmer" style={{ height: 48, borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="card shoplist"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <b style={{ fontSize: 14 }}>🛒 购物清单</b>
        <span className="section-cnt">{items.length} 项</span>
        {estimatedTotal > 0 && (
          <>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
              约 ¥{estimatedTotal.toFixed(0)}
              {pricedCount < items.length ? `（${pricedCount}/${items.length} 项有参考价）` : ''}
            </span>
          </>
        )}
      </div>
      <div className="sub" style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
        勾选的菜缺什么 + 库存告急的常备项；打勾 = 已买到，库存自动改「充足」
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>
            🧺
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>
            勾选缺料的菜，要买的东西会出现在这里
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, i) => {
            const key = item.inventoryId || `${item.name}-${i}`;
            const checked = checkedIds.has(key);
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  padding: '9px 10px',
                  border: '1px solid var(--line2)',
                  borderRadius: 10,
                  opacity: checked ? 0.65 : 1,
                  background: checked ? 'var(--hover)' : 'transparent',
                }}
              >
                <span
                  className={`cb${checked ? ' on' : ''}`}
                  style={{ marginTop: 1 }}
                  onClick={() => onToggle(key)}
                />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b style={{ fontSize: 12.5, textDecoration: checked ? 'line-through' : 'none' }}>
                    {item.name}
                  </b>
                  <div className="sub" style={{ fontSize: 11 }}>
                    {checked ? '已买到 → 库存已更新' : item.source}
                  </div>
                </div>
                {item.price !== undefined && (
                  <span style={{ fontSize: 11.5, color: 'var(--tx2)', flexShrink: 0, marginTop: 1 }}>
                    ¥{item.price}
                  </span>
                )}
              </div>
            );
          })}
          {checkedIds.size > 0 && (
            <button
              type="button"
              onClick={onCheckout}
              disabled={checkoutLoading}
              style={{
                marginTop: 4,
                padding: '6px 12px',
                borderRadius: 10,
                background: 'var(--primary-btn)',
                color: 'var(--primary-btn-tx)',
                border: '1px solid var(--primary-btn)',
                fontSize: 12,
                fontWeight: 600,
                cursor: checkoutLoading ? 'default' : 'pointer',
                opacity: checkoutLoading ? 0.7 : 1,
              }}
            >
              {checkoutLoading ? '更新中...' : `已买到（${checkedIds.size} 项）`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
