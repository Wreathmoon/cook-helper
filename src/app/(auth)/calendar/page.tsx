'use client';

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import type { CalendarEntry, CalendarStatus, StockLevel } from '@/types';
import {
  getCalendarEntriesAction, addCalendarEntryAction, completeEntryAction,
  deleteCalendarEntryAction, getRecipesForCalendar,
  getRecipeDetailForCalendar, updateStockOnCookAction,
} from '@/app/actions/calendar';
import { CalendarView } from '@/components/views';

type EntryWithRecipe = CalendarEntry & { recipe?: { name: string } };
type SimpleRecipe = { id: string; name: string };
type AddEntryParams = { date: string; recipeId: string; status: CalendarStatus };
type DoneIngredient = { id: string; name: string; level: StockLevel };
type StockUpdate = { id: string; stock_level: StockLevel };

export default function CalendarPage() {
  const [month, setMonth] = useState(dayjs());
  const [entries, setEntries] = useState<EntryWithRecipe[]>([]);
  const [recipes, setRecipes] = useState<SimpleRecipe[]>([]);

  const fetchEntries = useCallback(async () => {
    try {
      const year = month.year();
      const m = month.month() + 1;
      const res = await getCalendarEntriesAction(year, m);
      if (res.data) setEntries(res.data as EntryWithRecipe[]);
    } catch { message.error('操作失败'); }
  }, [month]);

  const fetchRecipes = async () => {
    const res = await getRecipesForCalendar();
    if (res.data) setRecipes(res.data.map((r) => ({ id: r.id, name: r.name })));
  };

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchRecipes(); }, []);

  const handleAdd = async (params: AddEntryParams) => {
    await addCalendarEntryAction({
      date: params.date,
      recipe_id: params.recipeId,
      status: params.status,
    });
    fetchEntries();
  };

  const handleDelete = async (entryId: string) => {
    await deleteCalendarEntryAction(entryId);
    fetchEntries();
  };

  const handleComplete = async (entryId: string) => {
    await completeEntryAction(entryId);
    fetchEntries();
  };

  const handleFetchDoneIngredients = async (entry: EntryWithRecipe) => {
    const res = await getRecipeDetailForCalendar(entry.recipe_id);
    if (res.data) {
      const mainIngs = res.data.ingredients.filter((i) => i.role === 'main');
      return mainIngs.map((i) => ({
        id: i.inventory_id,
        name: i.inventory?.name || '未知',
        level: (i.inventory?.stock_level as StockLevel) || 'enough',
      }));
    }
    return [];
  };

  const handleDoneSubmit = async (entryId: string, updates: StockUpdate[]) => {
    await updateStockOnCookAction(updates);
    await completeEntryAction(entryId);
    fetchEntries();
  };

  return (
    <CalendarView
      entries={entries}
      recipes={recipes}
      onAddEntry={handleAdd}
      onDeleteEntry={handleDelete}
      onCompleteEntry={handleComplete}
      onFetchDoneIngredients={handleFetchDoneIngredients}
      onDoneSubmit={handleDoneSubmit}
    />
  );
}
