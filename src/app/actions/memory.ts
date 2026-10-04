'use server';

import { listMemories, deleteMemory, type MemoryOverview } from '@/lib/services/memory';
import { getVault } from '@/lib/vault';
import { guardData, guardResult } from '@/lib/utils/error';
import { revalidatePath } from 'next/cache';

const EMPTY: MemoryOverview = {
  effective: [],
  ineffective: [],
  expired: [],
  aiConfigured: false,
  memoryDir: 'memory/',
};

export async function getListMemories() {
  return guardData(EMPTY, () => listMemories(getVault()));
}

export async function deleteMemoryAction(id: string) {
  const result = await guardResult(() => deleteMemory(getVault(), id));
  revalidatePath('/memory');
  return result;
}
