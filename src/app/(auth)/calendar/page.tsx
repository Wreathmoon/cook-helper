'use client';

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { Button, Modal, message, Segmented } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { TEXT } from '@/lib/constants/text';
import type { CalendarEntry, CalendarStatus, StockLevel } from '@/types';
import {
  getCalendarEntriesAction, addCalendarEntryAction, completeEntryAction,
  deleteCalendarEntryAction, getRecipesForCalendar,
  getRecipeDetailForCalendar, updateStockOnCookAction,
} from '@/app/actions/calendar';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusDot } from '@/components/shared/StatusDot';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const STOCK_LEVELS: { value: StockLevel; label: string }[] = [
  { value: 'enough', label: '充足' },
  { value: 'low', label: '不多' },
  { value: 'out', label: '没了' },
];

type EntryWithRecipe = CalendarEntry & { recipe?: { name: string } };
type SimpleRecipe = { id: string; name: string };

function getStockBg(s: string): string {
  return s === 'enough' ? 'var(--success-bg)' : s === 'low' ? 'var(--warn-bg)' : 'var(--danger-bg)';
}

function getStockDot(s: string): 'good' | 'warn' | 'bad' {
  return s === 'enough' ? 'good' : s === 'low' ? 'warn' : 'bad';
}

function chipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', borderRadius: 99,
    padding: '4px 12px', fontSize: 12, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
    background: active ? 'var(--primary-soft)' : 'var(--panel)',
    color: active ? 'var(--primary)' : 'var(--tx)',
    fontWeight: active ? 600 : 400,
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--panel)', color: 'var(--tx)', fontSize: 12.5, outline: 'none',
};

const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--tx2)', marginBottom: 4 };

export default function CalendarPage() {
  const [month, setMonth] = useState(dayjs());
  const [entries, setEntries] = useState<EntryWithRecipe[]>([]);
  const [recipes, setRecipes] = useState<SimpleRecipe[]>([]);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);

  // 记一笔/提前规划 弹窗（可指定任意日期）
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState(dayjs());
  const [addRecipeId, setAddRecipeId] = useState('');
  const [addRecipeSearch, setAddRecipeSearch] = useState('');
  const [addStatus, setAddStatus] = useState<CalendarStatus>('planned');

  // 右侧详情卡内联快速添加
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');

  // 完成弹窗
  const [doneModal, setDoneModal] = useState(false);
  const [doneEntry, setDoneEntry] = useState<EntryWithRecipe | null>(null);
  const [doneIngredients, setDoneIngredients] = useState<{ id: string; name: string; level: StockLevel }[]>([]);
  const [doneNewLevels, setDoneNewLevels] = useState<Record<string, StockLevel>>({});
  const [doneLoading, setDoneLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const year = month.year();
      const m = month.month() + 1;
      const res = await getCalendarEntriesAction(year, m);
      if (res.data) setEntries(res.data as EntryWithRecipe[]);
    } catch { message.error(TEXT.common.error); }
  }, [month]);

  const fetchRecipes = async () => {
    const res = await getRecipesForCalendar();
    if (res.data) setRecipes(res.data.map((r) => ({ id: r.id, name: r.name })));
  };

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchRecipes(); }, []);

  const getForDate = (date: string) => entries.filter((e) => e.date === date);

  const openAddModal = () => {
    setAddStatus('planned');
    setAddRecipeId('');
    setAddRecipeSearch('');
    setAddDate(selectedDate || dayjs());
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!addRecipeId || !addDate) return;
    try {
      await addCalendarEntryAction({
        date: addDate.format('YYYY-MM-DD'),
        recipe_id: addRecipeId, status: addStatus,
      });
      message.success(TEXT.common.success);
      setAddOpen(false);
      fetchEntries();
    } catch { message.error(TEXT.common.error); }
  };

  const handleQuickAdd = async (recipeId: string) => {
    if (!selectedDate) return;
    try {
      await addCalendarEntryAction({
        date: selectedDate.format('YYYY-MM-DD'),
        recipe_id: recipeId, status: 'planned',
      });
      message.success(TEXT.common.success);
      setQuickAddOpen(false);
      setQuickAddSearch('');
      fetchEntries();
    } catch { message.error(TEXT.common.error); }
  };

  const handleComplete = async (entryId: string) => {
    try {
      await completeEntryAction(entryId);
      fetchEntries();
    } catch { message.error(TEXT.common.error); }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteCalendarEntryAction(entryId);
      fetchEntries();
    } catch { message.error(TEXT.common.error); }
  };

  const openDoneModal = async (entry: EntryWithRecipe) => {
    try {
      const res = await getRecipeDetailForCalendar(entry.recipe_id);
      if (res.data) {
        const mainIngs = res.data.ingredients.filter((i) => i.role === 'main');
        const ings = mainIngs.map((i) => ({
          id: i.inventory_id,
          name: i.inventory?.name || '未知',
          level: (i.inventory?.stock_level as StockLevel) || 'enough',
        }));
        setDoneIngredients(ings);
        setDoneEntry(entry);
        const levels: Record<string, StockLevel> = {};
        ings.forEach((i) => { levels[i.id] = i.level; });
        setDoneNewLevels(levels);
        setDoneModal(true);
      }
    } catch { message.error(TEXT.common.error); }
  };

  const handleDoneSubmit = async () => {
    setDoneLoading(true);
    try {
      const updates = Object.entries(doneNewLevels).map(([id, stock_level]) => ({ id, stock_level }));
      await updateStockOnCookAction(updates);
      await completeEntryAction(doneEntry!.id);
      message.success('库存已更新');
      setDoneModal(false);
      fetchEntries();
    } catch { message.error(TEXT.common.error); } finally { setDoneLoading(false); }
  };

  // 月视图：固定 5 行 35 格，周一为一周首日，含跨月日期
  const startOfMonth = month.startOf('month');
  const startDow = startOfMonth.day();
  const mondayOffset = startDow === 0 ? 6 : startDow - 1;
  const gridStart = startOfMonth.subtract(mondayOffset, 'day');
  const cells: Dayjs[] = Array.from({ length: 35 }, (_, i) => gridStart.add(i, 'day'));

  const today = dayjs().format('YYYY-MM-DD');
  const isInMonth = (d: Dayjs) => d.month() === month.month() && d.year() === month.year();

  const selDateStr = selectedDate?.format('YYYY-MM-DD') || '';
  const selEntries = selectedDate ? getForDate(selDateStr) : [];

  const filteredAddRecipes = recipes.filter((r) => r.name.toLowerCase().includes(addRecipeSearch.toLowerCase()));
  const filteredQuickRecipes = recipes.filter((r) => r.name.toLowerCase().includes(quickAddSearch.toLowerCase()));

  return (
    <div>
      <PageHeader title="烹饪日历">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => setMonth(month.subtract(1, 'month'))}
            style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 10, padding: '4px 10px', cursor: 'pointer', color: 'var(--tx)', fontSize: 13 }}>
            ‹
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>{month.format('YYYY年M月')}</span>
          <button type="button" onClick={() => setMonth(month.add(1, 'month'))}
            style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 10, padding: '4px 10px', cursor: 'pointer', color: 'var(--tx)', fontSize: 13 }}>
            ›
          </button>
          <button type="button" onClick={() => { setMonth(dayjs()); setSelectedDate(dayjs()); }}
            style={{ borderRadius: 99, border: '1px solid var(--primary)', padding: '3px 12px', background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            今天
          </button>
          <span style={{ fontSize: 11.5, color: 'var(--tx2)' }}>{entries.length} 条记录</span>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={openAddModal}>
          ＋记一笔/提前规划
        </Button>
      </PageHeader>

      <div style={{ display: 'flex', gap: 16 }}>
        {/* 月视图 */}
        <div style={{ flex: 1 }}>
          {/* 星期行 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 2 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: 'center', padding: '6px 0', fontSize: 11.5, fontWeight: 600, color: 'var(--tx2)' }}>{w}</div>
            ))}
          </div>
          {/* 日期格：固定 5 行 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {cells.map((cell) => {
              const ds = cell.format('YYYY-MM-DD');
              const inMonth = isInMonth(cell);
              const dayEntries = inMonth ? getForDate(ds) : [];
              const todayFlag = ds === today;
              const selectedFlag = !!selectedDate && cell.isSame(selectedDate, 'day');

              return (
                <div key={ds}
                  className={inMonth ? 'cal-cell' : 'cal-cell cal-cell-outside'}
                  onClick={() => {
                    if (!inMonth) setMonth(cell.startOf('month'));
                    setSelectedDate(cell);
                  }}
                  style={{
                    minHeight: 84, borderRadius: 8, padding: 4, cursor: 'pointer',
                    background: todayFlag ? 'var(--primary-soft)' : !inMonth ? 'var(--hover)' : undefined,
                    boxShadow: (todayFlag || selectedFlag) ? 'inset 0 0 0 1.5px var(--primary)' : 'inset 0 0 0 1px var(--line2)',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                  <div style={{
                    fontSize: 11.5, fontWeight: todayFlag ? 700 : 400,
                    color: todayFlag ? 'var(--primary)' : inMonth ? 'var(--tx)' : 'var(--tx2)',
                  }}>
                    {cell.date()}
                  </div>
                  {dayEntries.slice(0, 2).map((e) => (
                    <div key={e.id} style={{
                      fontSize: 10, borderRadius: 4, padding: '1px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      background: e.status === 'completed' ? 'var(--success-bg)' : 'transparent',
                      border: e.status === 'planned' ? '1px dashed var(--line)' : 'none',
                      color: e.status === 'completed' ? 'var(--success)' : 'var(--tx2)',
                    }}>
                      {e.status === 'completed' ? '✓' : '◌'} {e.recipe?.name || ''}
                    </div>
                  ))}
                  {dayEntries.length > 2 && <div style={{ fontSize: 9, color: 'var(--tx2)' }}>+{dayEntries.length - 2}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧详情 */}
        {selectedDate && (
          <div style={{
            width: 270, flexShrink: 0, borderRadius: 14,
            background: 'var(--panel)', border: '1px solid var(--line)',
            padding: 14, alignSelf: 'flex-start',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 10 }}>
              {selectedDate.format('M月D日')}
            </div>

            {selEntries.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--tx2)', padding: '12px 0', textAlign: 'center' }}>
                这天还没有记录
              </div>
            )}
            {selEntries.map((e) => (
              <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>{e.recipe?.name || '未知'}</span>
                  <span style={{
                    fontSize: 10, borderRadius: 4, padding: '0 6px',
                    background: e.status === 'completed' ? 'var(--success-bg)' : 'transparent',
                    border: e.status === 'planned' ? '1px dashed var(--line)' : 'none',
                    color: e.status === 'completed' ? 'var(--success)' : 'var(--tx2)',
                  }}>
                    {e.status === 'completed' ? '已完成' : '计划中'}
                  </span>
                </div>
                {e.status === 'planned' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => openDoneModal(e)}
                      style={{ flex: 1, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--primary-btn)', background: 'var(--primary-btn)', color: 'var(--primary-btn-tx)', fontSize: 11, cursor: 'pointer' }}>
                      我做完啦
                    </button>
                    <button type="button" onClick={() => handleDelete(e.id)}
                      style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--danger)', fontSize: 11, cursor: 'pointer' }}>
                      取消
                    </button>
                  </div>
                )}
                {e.status === 'completed' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => openDoneModal(e)}
                      style={{ flex: 1, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--primary-btn)', background: 'var(--primary-btn)', color: 'var(--primary-btn-tx)', fontSize: 11, cursor: 'pointer' }}>
                      更新库存
                    </button>
                    <button type="button" onClick={() => handleDelete(e.id)}
                      style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--danger)', fontSize: 11, cursor: 'pointer' }}>
                      🗑
                    </button>
                  </div>
                )}
              </div>
            ))}

            <button type="button" onClick={() => { setQuickAddOpen((v) => !v); setQuickAddSearch(''); }}
              style={{
                width: '100%', padding: '7px 0', borderRadius: 10,
                border: '1px dashed var(--line)', background: 'transparent',
                color: 'var(--tx2)', fontSize: 12, cursor: 'pointer',
              }}>
              ＋ 给这天加一道
            </button>

            {quickAddOpen && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  type="text" placeholder="搜索菜谱..." value={quickAddSearch}
                  onChange={(e) => setQuickAddSearch(e.target.value)}
                  style={{ ...inputStyle, padding: '5px 10px', fontSize: 12 }}
                  autoFocus
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                  {filteredQuickRecipes.length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--tx2)' }}>没有匹配的菜谱</span>
                  )}
                  {filteredQuickRecipes.map((r) => (
                    <span key={r.id} className="chip-pick" onClick={() => handleQuickAdd(r.id)} style={chipStyle(false)}>
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 记一笔/提前规划 弹窗 */}
      <Modal title="添加记录" open={addOpen} onOk={handleAdd} onCancel={() => setAddOpen(false)}
        okButtonProps={{ disabled: !addRecipeId }} okText="确认" cancelText="取消" width={360}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>日期</div>
          <input
            type="date"
            value={addDate.format('YYYY-MM-DD')}
            onChange={(e) => { if (e.target.value) setAddDate(dayjs(e.target.value)); }}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>状态</div>
          <Segmented value={addStatus} onChange={(v) => setAddStatus(v as CalendarStatus)}
            options={[{ value: 'planned', label: '计划做' }, { value: 'completed', label: '已做完' }]} />
        </div>
        <div>
          <div style={labelStyle}>选择菜谱</div>
          <input
            type="text" placeholder="搜索菜谱..." value={addRecipeSearch}
            onChange={(e) => setAddRecipeSearch(e.target.value)}
            style={inputStyle}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto', marginTop: 8 }}>
            {filteredAddRecipes.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--tx2)' }}>没有匹配的菜谱</span>
            )}
            {filteredAddRecipes.map((r) => (
              <span key={r.id} className="chip-pick" onClick={() => setAddRecipeId(r.id)} style={chipStyle(addRecipeId === r.id)}>
                {r.name}
              </span>
            ))}
          </div>
        </div>
      </Modal>

      {/* 完成弹窗 */}
      <Modal title="更新食材库存" open={doneModal} onOk={handleDoneSubmit} onCancel={() => setDoneModal(false)}
        confirmLoading={doneLoading} okText="确认更新库存" cancelText="跳过" width={360}
      >
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>
          做完了「{doneEntry?.recipe?.name || ''}」🎉
        </div>
        {doneIngredients.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--tx2)' }}>该菜谱没有主要食材</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {doneIngredients.map((ing) => (
              <div key={ing.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StatusDot status={getStockDot(doneNewLevels[ing.id] || 'enough')} />
                  <span style={{ fontSize: 12.5, color: 'var(--tx)' }}>{ing.name}</span>
                </div>
                <Segmented
                  value={doneNewLevels[ing.id] || 'enough'}
                  onChange={(v) => setDoneNewLevels((prev) => ({ ...prev, [ing.id]: v as StockLevel }))}
                  options={STOCK_LEVELS.map((opt) => ({
                    ...opt, style: {
                      background: (doneNewLevels[ing.id] || 'enough') === opt.value ? getStockBg(opt.value) : undefined,
                      color: (doneNewLevels[ing.id] || 'enough') === opt.value ? 'var(--tx)' : undefined,
                    },
                  }))}
                  size="small"
                />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
