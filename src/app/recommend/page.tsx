'use client';

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { getRecommendations, generateShoppingListAction, checkoutShoppingListAction } from '@/app/actions/recommend';
import { addCalendarEntryAction } from '@/app/actions/calendar';
import { getListInventory } from '@/app/actions/inventory';
import { getListUtensils } from '@/app/actions/utensil';
import type { RecommendedRecipe, ShoppingListItem } from '@/types';
import { RecommendView } from '@/components/views';

function buildServerFilters(_filters: Record<string, string[]>): { maxCookTime?: number; spiciness?: string; method?: string[] } {
  return {};
}

export default function RecommendPage() {
  const [allRecs, setAllRecs] = useState<RecommendedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [utensilCount, setUtensilCount] = useState(0);
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [shoppingLoading, setShoppingLoading] = useState(true);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const refreshShoppingList = useCallback(async (ids: Set<string>) => {
    setShoppingLoading(true);
    try {
      const res = await generateShoppingListAction(Array.from(ids));
      if (res.data) setShoppingItems(res.data);
    } catch { /* */ } finally { setShoppingLoading(false); }
  }, []);

  const fetchRecs = useCallback(async () => {
    try {
      const res = await getRecommendations(buildServerFilters({}));
      if (res.data) {
        const order: Record<string, number> = { clear_stock: 0, can_make_now: 1, need_shopping: 2 };
        setAllRecs([...res.data].sort((a, b) => (order[a.tier] ?? 3) - (order[b.tier] ?? 3)));
        setCheckedItems(new Set());
        refreshShoppingList(new Set());
      }
    } catch { message.error('获取推荐失败'); }
    finally { setLoading(false); }
  }, [refreshShoppingList]);

  // 首屏加载写成带取消标记的 async IIFE：setState 落在 await 之后，
  // 组件已经卸载就不再写状态（也顺带满足 react-hooks/set-state-in-effect）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [invRes, utilRes, recRes] = await Promise.all([
          getListInventory(),
          getListUtensils(),
          getRecommendations(buildServerFilters({})),
        ]);
        if (cancelled) return;

        if (invRes.data) setInventoryCount(invRes.data.length);
        if (utilRes.data) setUtensilCount(utilRes.data.length);
        if (recRes.error) message.error(recRes.error);
        if (recRes.data) {
          const order: Record<string, number> = { clear_stock: 0, can_make_now: 1, need_shopping: 2 };
          setAllRecs([...recRes.data].sort((a, b) => (order[a.tier] ?? 3) - (order[b.tier] ?? 3)));
          setCheckedItems(new Set());
          void refreshShoppingList(new Set());
        }
      } catch {
        if (!cancelled) message.error('获取推荐失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshShoppingList]);

  const handleCook = async (rec: RecommendedRecipe) => {
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await addCalendarEntryAction({ date: dateStr, recipe_id: rec.recipe.id, status: 'planned' });
      if (res.error) message.error(res.error);
      else message.success(`已把「${rec.recipe.name}」写进今天的日历`);
    } catch { message.error('操作失败'); }
  };

  const handleToggleSelect = async (recipeId: string) => {
    setShoppingLoading(true);
    try {
      const res = await generateShoppingListAction([recipeId]);
      if (res.data) setShoppingItems(res.data);
    } catch { /* */ } finally { setShoppingLoading(false); }
  };

  const handleToggleCheckout = (key: string) => {
    setCheckedItems((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const res = await checkoutShoppingListAction(Array.from(checkedItems));
      if (res.error) message.error(res.error);
      else { message.success('库存已更新'); setCheckedItems(new Set()); await fetchRecs(); }
    } catch { message.error('操作失败'); }
    finally { setCheckoutLoading(false); }
  };

  return (
    <RecommendView
      allRecs={allRecs} loading={loading}
      inventoryCount={inventoryCount} utensilCount={utensilCount}
      shoppingItems={shoppingItems} shoppingLoading={shoppingLoading}
      checkedItems={checkedItems} checkoutLoading={checkoutLoading}
      onCook={handleCook}
      onRefreshBatch={() => {}}
      onSwapSlot={() => {}}
      onToggleSelect={handleToggleSelect}
      onToggleCheckout={handleToggleCheckout}
      onCheckout={handleCheckout}
    />
  );
}
