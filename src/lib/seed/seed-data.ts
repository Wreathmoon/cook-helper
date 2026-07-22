import type { InventoryCategory, RecipeAttributes, Difficulty } from '@/types';

export interface SeedIngredient {
  name: string;
  category: InventoryCategory;
  unit?: string;
}

export interface SeedRecipe {
  name: string;
  steps?: { step_number: number; description: string }[];
  cook_time_minutes?: number;
  difficulty?: Difficulty;
  attributes: RecipeAttributes;
  tips?: string;
  ingredients: {
    name: string;
    role: 'main' | 'auxiliary' | 'seasoning';
    amount?: string;
  }[];
  utensils?: string[];
}

export const seedIngredients: SeedIngredient[] = [
  // 蔬菜
  { name: '白菜', category: 'vegetable', unit: '颗' },
  { name: '土豆', category: 'vegetable', unit: '个' },
  { name: '西红柿', category: 'vegetable', unit: '个' },
  { name: '黄瓜', category: 'vegetable', unit: '根' },
  { name: '茄子', category: 'vegetable', unit: '根' },
  { name: '青椒', category: 'vegetable', unit: '个' },
  { name: '豆角', category: 'vegetable', unit: 'g' },
  { name: '菠菜', category: 'vegetable', unit: '把' },
  { name: '芹菜', category: 'vegetable', unit: '把' },
  { name: '胡萝卜', category: 'vegetable', unit: '根' },
  { name: '洋葱', category: 'vegetable', unit: '个' },
  { name: '西兰花', category: 'vegetable', unit: '颗' },
  { name: '香菇', category: 'vegetable', unit: '朵' },
  { name: '豆芽', category: 'vegetable', unit: '把' },
  { name: '韭菜', category: 'vegetable', unit: '把' },
  { name: '南瓜', category: 'vegetable', unit: '块' },
  { name: '冬瓜', category: 'vegetable', unit: '块' },
  { name: '紫菜', category: 'vegetable', unit: '块' },
  // 肉类
  { name: '猪肉', category: 'meat', unit: 'g' },
  { name: '牛肉', category: 'meat', unit: 'g' },
  { name: '鸡胸肉', category: 'meat', unit: 'g' },
  { name: '鸡腿', category: 'meat', unit: '个' },
  { name: '排骨', category: 'meat', unit: 'g' },
  { name: '鱼', category: 'meat', unit: '条' },
  { name: '虾', category: 'meat', unit: 'g' },
  { name: '鸡蛋', category: 'egg_dairy_bean', unit: '个' },
  // 蛋奶豆制品
  { name: '豆腐', category: 'egg_dairy_bean', unit: '块' },
  { name: '豆干', category: 'egg_dairy_bean', unit: '块' },
  // 主食/干货
  { name: '大米', category: 'staple', unit: 'g' },
  { name: '面条', category: 'staple', unit: 'g' },
  { name: '面粉', category: 'staple', unit: 'g' },
  // 调料
  { name: '盐', category: 'seasoning' },
  { name: '生抽', category: 'seasoning' },
  { name: '老抽', category: 'seasoning' },
  { name: '料酒', category: 'seasoning' },
  { name: '醋', category: 'seasoning' },
  { name: '白糖', category: 'seasoning' },
  { name: '食用油', category: 'seasoning' },
  { name: '香油', category: 'seasoning' },
  { name: '蚝油', category: 'seasoning' },
  { name: '淀粉', category: 'seasoning' },
  { name: '花椒', category: 'seasoning' },
  { name: '干辣椒', category: 'seasoning' },
  { name: '葱姜蒜', category: 'seasoning' },
  { name: '豆瓣酱', category: 'seasoning' },
  { name: '番茄酱', category: 'seasoning' },
  { name: '辣椒油', category: 'seasoning' },
  { name: '胡椒粉', category: 'seasoning' },
];

export const seedRecipes: SeedRecipe[] = [
  // ====== 荤菜 (18) ======
  {
    name: '红烧肉', difficulty: 'medium', cook_time_minutes: 90,
    attributes: { method: ['炖'], spiciness: '不辣', greasiness: '重油', flavor: '咸鲜', diet_type: '纯荤' },
    ingredients: [
      { name: '猪肉', role: 'main', amount: '500g' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '老抽', role: 'seasoning', amount: '1勺' },
      { name: '料酒', role: 'seasoning', amount: '2勺' }, { name: '白糖', role: 'seasoning', amount: '30g' },
    ],
    steps: [
      { step_number: 1, description: '猪肉切块，冷水下锅焯水去血沫，捞出洗净' },
      { step_number: 2, description: '锅中放少许油，加白糖小火炒至焦糖色' },
      { step_number: 3, description: '放入猪肉翻炒上色，加葱姜蒜、料酒、生抽、老抽' },
      { step_number: 4, description: '加开水没过肉，大火烧开转小火炖60分钟' },
      { step_number: 5, description: '大火收汁，汤汁浓稠即可' },
    ],
    tips: '用冰糖炒色更红亮，炖的时间越长越软烂', utensils: ['炒锅'],
  },
  {
    name: '宫保鸡丁', difficulty: 'medium', cook_time_minutes: 20,
    attributes: { method: ['炒'], spiciness: '中辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '鸡胸肉', role: 'main', amount: '300g' }, { name: '青椒', role: 'auxiliary', amount: '1个' },
      { name: '胡萝卜', role: 'auxiliary', amount: '半根' }, { name: '花椒', role: 'seasoning', amount: '少许' },
      { name: '干辣椒', role: 'seasoning', amount: '5个' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '醋', role: 'seasoning', amount: '1勺' },
      { name: '白糖', role: 'seasoning', amount: '1勺' }, { name: '淀粉', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '鸡胸肉切丁，加料酒、淀粉腌制15分钟' },
      { step_number: 2, description: '调碗汁：生抽、醋、白糖、淀粉、水混合' },
      { step_number: 3, description: '热锅凉油，放花椒、干辣椒爆香，下鸡丁滑炒变色' },
      { step_number: 4, description: '加入青椒丁、胡萝卜丁翻炒，倒入碗汁翻炒均匀' },
    ],
    tips: '鸡肉腌制后更嫩滑，大火快炒保持口感', utensils: ['炒锅'],
  },
  {
    name: '糖醋排骨', difficulty: 'medium', cook_time_minutes: 40,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '适中', flavor: '带甜', diet_type: '纯荤' },
    ingredients: [
      { name: '排骨', role: 'main', amount: '500g' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '醋', role: 'seasoning', amount: '3勺' },
      { name: '白糖', role: 'seasoning', amount: '3勺' }, { name: '料酒', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '排骨冷水下锅焯水，捞出洗净沥干' },
      { step_number: 2, description: '锅中放油，放入排骨煎至两面金黄' },
      { step_number: 3, description: '加葱姜蒜、料酒、生抽、醋、白糖和适量水' },
      { step_number: 4, description: '大火烧开转小火炖25分钟，大火收汁' },
    ],
    tips: '糖醋比例1:1口感最佳', utensils: ['炒锅'],
  },
  {
    name: '鱼香肉丝', difficulty: 'medium', cook_time_minutes: 20,
    attributes: { method: ['炒'], spiciness: '微辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '猪肉', role: 'main', amount: '200g' }, { name: '胡萝卜', role: 'auxiliary', amount: '1根' },
      { name: '青椒', role: 'auxiliary', amount: '1个' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '豆瓣酱', role: 'seasoning', amount: '1勺' }, { name: '生抽', role: 'seasoning', amount: '1勺' },
      { name: '醋', role: 'seasoning', amount: '1勺' }, { name: '白糖', role: 'seasoning', amount: '1勺' },
      { name: '淀粉', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '猪肉切丝，加料酒、淀粉腌制10分钟' },
      { step_number: 2, description: '胡萝卜、青椒切丝，调好鱼香汁备用' },
      { step_number: 3, description: '热锅下肉丝炒至变色盛出' },
      { step_number: 4, description: '锅中加油，放豆瓣酱炒出红油，下蔬菜丝翻炒' },
      { step_number: 5, description: '倒回肉丝，淋入鱼香汁翻炒均匀' },
    ],
    tips: '鱼香汁是灵魂：酸甜咸辣鲜', utensils: ['炒锅'],
  },
  {
    name: '回锅肉', difficulty: 'easy', cook_time_minutes: 20,
    attributes: { method: ['炒'], spiciness: '微辣', greasiness: '重油', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '猪肉', role: 'main', amount: '300g' }, { name: '青椒', role: 'auxiliary', amount: '2个' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '豆瓣酱', role: 'seasoning', amount: '1.5勺' },
      { name: '生抽', role: 'seasoning', amount: '1勺' }, { name: '料酒', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '猪肉整块冷水下锅，加葱姜料酒煮20分钟，捞出切片' },
      { step_number: 2, description: '青椒切片，锅中不放油直接放肉片煸出油脂' },
      { step_number: 3, description: '肉片微焦时拨到一边，放豆瓣酱炒出红油' },
      { step_number: 4, description: '加入青椒翻炒断生，加生抽调味即可' },
    ],
    tips: '肉片要煸出油脂才香', utensils: ['炒锅'],
  },
  {
    name: '麻婆豆腐', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['炒'], spiciness: '中辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '豆腐', role: 'main', amount: '1块' }, { name: '猪肉', role: 'auxiliary', amount: '100g' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '豆瓣酱', role: 'seasoning', amount: '1.5勺' },
      { name: '花椒', role: 'seasoning', amount: '少许' }, { name: '生抽', role: 'seasoning', amount: '1勺' },
      { name: '淀粉', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '豆腐切小块，开水焯2分钟去豆腥' },
      { step_number: 2, description: '锅中加油，放肉末炒散，加豆瓣酱炒出红油' },
      { step_number: 3, description: '加适量水烧开，放入豆腐小火煮5分钟' },
      { step_number: 4, description: '水淀粉勾芡，撒花椒粉和葱花' },
    ],
    tips: '豆腐焯水不易碎，芡汁要分次加', utensils: ['炒锅'],
  },
  {
    name: '青椒肉丝', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['炒'], spiciness: '微辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '猪肉', role: 'main', amount: '200g' }, { name: '青椒', role: 'main', amount: '3个' },
      { name: '生抽', role: 'seasoning', amount: '1勺' }, { name: '料酒', role: 'seasoning', amount: '1勺' },
      { name: '淀粉', role: 'seasoning', amount: '适量' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '猪肉切丝，加料酒、生抽、淀粉腌制10分钟' },
      { step_number: 2, description: '青椒切丝，热锅下肉丝炒至变色盛出' },
      { step_number: 3, description: '锅中加油放青椒丝翻炒断生，倒回肉丝翻炒均匀' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '可乐鸡翅', difficulty: 'easy', cook_time_minutes: 30,
    attributes: { method: ['炖'], spiciness: '不辣', greasiness: '适中', flavor: '带甜', diet_type: '纯荤' },
    ingredients: [
      { name: '鸡腿', role: 'main', amount: '8个' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '老抽', role: 'seasoning', amount: '1勺' },
      { name: '料酒', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '鸡翅两面划刀，冷水下锅焯水' },
      { step_number: 2, description: '锅中放油，将鸡翅煎至两面金黄' },
      { step_number: 3, description: '加葱姜蒜、料酒、生抽、老抽，倒入可乐没过鸡翅' },
      { step_number: 4, description: '大火烧开转中火炖20分钟，大火收汁' },
    ],
    tips: '可乐代替糖，色泽红亮味道好', utensils: ['炒锅'],
  },
  {
    name: '酸辣土豆丝', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['炒'], spiciness: '中辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '土豆', role: 'main', amount: '2个' }, { name: '猪肉', role: 'auxiliary', amount: '50g' },
      { name: '干辣椒', role: 'seasoning', amount: '5个' }, { name: '花椒', role: 'seasoning', amount: '少许' },
      { name: '醋', role: 'seasoning', amount: '2勺' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '土豆去皮切细丝，泡水去淀粉' },
      { step_number: 2, description: '热锅下肉丝炒变色，放花椒、干辣椒爆香' },
      { step_number: 3, description: '下土豆丝大火翻炒2分钟' },
      { step_number: 4, description: '加醋、盐调味，翻炒均匀出锅' },
    ],
    tips: '土豆丝要细，泡水后更脆爽', utensils: ['炒锅'],
  },
  {
    name: '西红柿炒鸡蛋', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '西红柿', role: 'main', amount: '2个' }, { name: '鸡蛋', role: 'main', amount: '3个' },
      { name: '盐', role: 'seasoning', amount: '适量' }, { name: '白糖', role: 'seasoning', amount: '少许' },
      { name: '食用油', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '西红柿切块，鸡蛋打散' },
      { step_number: 2, description: '热锅凉油，倒入蛋液炒至凝固盛出' },
      { step_number: 3, description: '锅中加油，放入西红柿翻炒出汁' },
      { step_number: 4, description: '加入炒好的鸡蛋，加盐和糖调味，翻炒均匀' },
    ],
    tips: '先炒蛋再炒西红柿，加糖提鲜', utensils: ['炒锅'],
  },
  {
    name: '水煮鱼', difficulty: 'hard', cook_time_minutes: 30,
    attributes: { method: ['煮'], spiciness: '重辣', greasiness: '重油', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '鱼', role: 'main', amount: '1条' }, { name: '豆芽', role: 'auxiliary', amount: '1把' },
      { name: '干辣椒', role: 'seasoning', amount: '15个' }, { name: '花椒', role: 'seasoning', amount: '1勺' },
      { name: '豆瓣酱', role: 'seasoning', amount: '2勺' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '料酒', role: 'seasoning', amount: '1勺' }, { name: '淀粉', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '鱼片成薄片，加料酒、盐、淀粉腌制15分钟' },
      { step_number: 2, description: '豆芽焯水铺在碗底' },
      { step_number: 3, description: '锅中加油放豆瓣酱炒出红油，加水烧开' },
      { step_number: 4, description: '放入鱼片煮至变白，连汤倒在豆芽上' },
      { step_number: 5, description: '表面放干辣椒、花椒、蒜末，浇热油激香' },
    ],
    tips: '鱼片要薄，煮的时间不要长', utensils: ['炒锅'],
  },
  {
    name: '啤酒鸭', difficulty: 'medium', cook_time_minutes: 60,
    attributes: { method: ['炖'], spiciness: '微辣', greasiness: '适中', flavor: '咸鲜', diet_type: '纯荤' },
    ingredients: [
      { name: '鸭', role: 'main', amount: '半只' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '老抽', role: 'seasoning', amount: '1勺' },
      { name: '料酒', role: 'seasoning', amount: '2勺' }, { name: '花椒', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '鸭肉切块焯水，洗净沥干' },
      { step_number: 2, description: '锅中放油，放鸭肉煸炒至微黄' },
      { step_number: 3, description: '加葱姜蒜、花椒、生抽、老抽、料酒翻炒' },
      { step_number: 4, description: '倒入啤酒没过鸭肉，大火烧开转小火炖45分钟' },
      { step_number: 5, description: '大火收汁即可' },
    ],
    tips: '啤酒去腥增香，不用额外加水', utensils: ['炒锅'],
  },
  {
    name: '干煸四季豆', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['炒'], spiciness: '中辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '豆角', role: 'main', amount: '300g' }, { name: '猪肉', role: 'auxiliary', amount: '100g' },
      { name: '干辣椒', role: 'seasoning', amount: '5个' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '豆角去筋洗净掰成段' },
      { step_number: 2, description: '锅中多放油，将豆角炸至表皮起皱，捞出' },
      { step_number: 3, description: '锅留底油，放肉末炒散，加干辣椒、蒜末爆香' },
      { step_number: 4, description: '放入豆角翻炒，加生抽、盐调味' },
    ],
    tips: '豆角要炸透才好吃，注意安全别溅油', utensils: ['炒锅'],
  },
  {
    name: '辣子鸡', difficulty: 'medium', cook_time_minutes: 25,
    attributes: { method: ['炒'], spiciness: '重辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '鸡腿', role: 'main', amount: '4个' }, { name: '干辣椒', role: 'seasoning', amount: '20个' },
      { name: '花椒', role: 'seasoning', amount: '1勺' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '料酒', role: 'seasoning', amount: '1勺' }, { name: '生抽', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '鸡腿切小块，加料酒、盐腌制15分钟' },
      { step_number: 2, description: '锅中多放油，将鸡块炸至金黄酥脆，捞出' },
      { step_number: 3, description: '锅留底油，小火炒香干辣椒和花椒' },
      { step_number: 4, description: '放入鸡块翻炒，加生抽、盐调味' },
    ],
    tips: '辣椒要多，在辣椒里找鸡块是乐趣', utensils: ['炒锅'],
  },
  {
    name: '蒸鸡蛋羹', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['蒸'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '荤素搭配' },
    ingredients: [
      { name: '鸡蛋', role: 'main', amount: '3个' }, { name: '盐', role: 'seasoning', amount: '少许' },
      { name: '香油', role: 'seasoning', amount: '几滴' }, { name: '生抽', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '鸡蛋打散，加1.5倍温水和少许盐搅匀' },
      { step_number: 2, description: '过筛去除泡沫，盖保鲜膜扎几个小孔' },
      { step_number: 3, description: '水开后上锅，中火蒸10分钟' },
      { step_number: 4, description: '出锅淋少许生抽和香油' },
    ],
    tips: '蛋水比1:1.5，过筛更嫩滑', utensils: ['蒸锅'],
  },
  {
    name: '香菇滑鸡', difficulty: 'easy', cook_time_minutes: 25,
    attributes: { method: ['蒸'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '鸡腿', role: 'main', amount: '3个' }, { name: '香菇', role: 'auxiliary', amount: '6朵' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '料酒', role: 'seasoning', amount: '1勺' },
      { name: '淀粉', role: 'seasoning', amount: '1勺' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '鸡腿切块，加生抽、料酒、淀粉腌制20分钟' },
      { step_number: 2, description: '香菇泡发切半，铺在盘底' },
      { step_number: 3, description: '鸡块铺在香菇上，水开后蒸20分钟' },
    ],
    tips: '腌制时间长一些更入味', utensils: ['蒸锅'],
  },
  {
    name: '黄焖鸡', difficulty: 'medium', cook_time_minutes: 40,
    attributes: { method: ['炖'], spiciness: '微辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '鸡腿', role: 'main', amount: '4个' }, { name: '香菇', role: 'auxiliary', amount: '5朵' },
      { name: '青椒', role: 'auxiliary', amount: '1个' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '老抽', role: 'seasoning', amount: '1勺' },
      { name: '蚝油', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '鸡腿切块焯水，香菇泡发' },
      { step_number: 2, description: '锅中加油，放葱姜蒜爆香，下鸡块翻炒' },
      { step_number: 3, description: '加生抽、老抽、蚝油、料酒，加水和香菇' },
      { step_number: 4, description: '大火烧开转小火炖25分钟' },
      { step_number: 5, description: '加入青椒块，大火收汁' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '蒜蓉虾', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['蒸'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '纯荤' },
    ingredients: [
      { name: '虾', role: 'main', amount: '300g' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '1勺' }, { name: '料酒', role: 'seasoning', amount: '1勺' },
      { name: '食用油', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '虾开背去虾线，加料酒腌制5分钟' },
      { step_number: 2, description: '蒜切末，热油浇在蒜末上激出香味' },
      { step_number: 3, description: '虾摆盘，铺上蒜蓉，水开后蒸8分钟' },
      { step_number: 4, description: '出锅淋生抽，撒葱花' },
    ],
    tips: '虾不要蒸太久，肉会老', utensils: ['蒸锅'],
  },
  // ====== 素菜 (16) ======
  {
    name: '地三鲜', difficulty: 'easy', cook_time_minutes: 20,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '土豆', role: 'main', amount: '1个' }, { name: '茄子', role: 'main', amount: '1根' },
      { name: '青椒', role: 'main', amount: '1个' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '蚝油', role: 'seasoning', amount: '1勺' },
      { name: '淀粉', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '土豆、茄子切块，青椒切块' },
      { step_number: 2, description: '锅中多放油，分别将土豆和茄子炸至金黄捞出' },
      { step_number: 3, description: '锅留底油，放葱姜蒜爆香，加生抽、蚝油和少许水' },
      { step_number: 4, description: '放入所有食材翻炒，水淀粉勾芡' },
    ],
    tips: '茄子炸之前可以拍点淀粉，减少吸油', utensils: ['炒锅'],
  },
  {
    name: '手撕包菜', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['炒'], spiciness: '微辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '白菜', role: 'main', amount: '半颗' }, { name: '干辣椒', role: 'seasoning', amount: '5个' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '醋', role: 'seasoning', amount: '1勺' },
      { name: '生抽', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '白菜手撕成小块，洗净沥干' },
      { step_number: 2, description: '热锅加油，放干辣椒和蒜片爆香' },
      { step_number: 3, description: '大火放入白菜快速翻炒' },
      { step_number: 4, description: '加生抽、醋、盐调味，炒至断生即可' },
    ],
    tips: '大火快炒，保持脆爽', utensils: ['炒锅'],
  },
  {
    name: '醋溜白菜', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['炒'], spiciness: '微辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '白菜', role: 'main', amount: '半颗' }, { name: '干辣椒', role: 'seasoning', amount: '3个' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '醋', role: 'seasoning', amount: '2勺' },
      { name: '生抽', role: 'seasoning', amount: '1勺' }, { name: '白糖', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '白菜叶和帮分开切块' },
      { step_number: 2, description: '热锅下干辣椒和蒜片爆香' },
      { step_number: 3, description: '先下白菜帮翻炒1分钟，再下菜叶' },
      { step_number: 4, description: '加醋、生抽、糖和盐翻炒均匀' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '蒜蓉西兰花', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '纯素' },
    ingredients: [
      { name: '西兰花', role: 'main', amount: '1颗' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '蚝油', role: 'seasoning', amount: '1勺' }, { name: '盐', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '西兰花掰成小朵，开水焯2分钟捞出' },
      { step_number: 2, description: '热锅加油，放蒜末爆香' },
      { step_number: 3, description: '放入西兰花翻炒，加蚝油和盐调味' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '凉拌黄瓜', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['凉拌'], spiciness: '微辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '黄瓜', role: 'main', amount: '2根' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '醋', role: 'seasoning', amount: '2勺' }, { name: '生抽', role: 'seasoning', amount: '1勺' },
      { name: '辣椒油', role: 'seasoning', amount: '1勺' }, { name: '香油', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '黄瓜洗净拍碎，切段' },
      { step_number: 2, description: '蒜切末，与醋、生抽、辣椒油、香油混合成调料汁' },
      { step_number: 3, description: '将调料汁浇在黄瓜上，拌匀即可' },
    ],
    tips: '拍黄瓜比切的更入味', utensils: [],
  },
  {
    name: '干煸豆角', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['炒'], spiciness: '微辣', greasiness: '适中', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '豆角', role: 'main', amount: '300g' }, { name: '干辣椒', role: 'seasoning', amount: '5个' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '生抽', role: 'seasoning', amount: '1勺' },
      { name: '花椒', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '豆角去筋洗净掰段' },
      { step_number: 2, description: '锅中多放油，将豆角炸至表皮起皱捞出' },
      { step_number: 3, description: '锅留底油，放花椒、干辣椒、蒜末爆香' },
      { step_number: 4, description: '放入豆角翻炒，加生抽和盐调味' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '鱼香茄子', difficulty: 'easy', cook_time_minutes: 20,
    attributes: { method: ['炒'], spiciness: '微辣', greasiness: '适中', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '茄子', role: 'main', amount: '2根' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '豆瓣酱', role: 'seasoning', amount: '1勺' }, { name: '生抽', role: 'seasoning', amount: '1勺' },
      { name: '醋', role: 'seasoning', amount: '1勺' }, { name: '白糖', role: 'seasoning', amount: '1勺' },
      { name: '淀粉', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '茄子切长条，撒盐腌10分钟挤去水分' },
      { step_number: 2, description: '调鱼香汁：生抽、醋、糖、淀粉、水混合' },
      { step_number: 3, description: '锅中加油，放茄子煎至软盛出' },
      { step_number: 4, description: '锅中加油放豆瓣酱炒出红油，加蒜末，倒回茄子' },
      { step_number: 5, description: '淋入鱼香汁翻炒均匀' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '芹菜花生米', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '纯素' },
    ingredients: [
      { name: '芹菜', role: 'main', amount: '1把' }, { name: '胡萝卜', role: 'auxiliary', amount: '1根' },
      { name: '盐', role: 'seasoning', amount: '适量' }, { name: '香油', role: 'seasoning', amount: '少许' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '芹菜去叶切丁，胡萝卜切丁' },
      { step_number: 2, description: '开水焯芹菜和胡萝卜丁各1分钟捞出' },
      { step_number: 3, description: '热锅加油翻炒，加盐调味' },
      { step_number: 4, description: '出锅淋香油' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '韭菜炒豆干', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '韭菜', role: 'main', amount: '1把' }, { name: '豆干', role: 'main', amount: '2块' },
      { name: '生抽', role: 'seasoning', amount: '1勺' }, { name: '盐', role: 'seasoning', amount: '适量' },
      { name: '食用油', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '韭菜洗净切段，豆干切条' },
      { step_number: 2, description: '热锅加油，先放豆干翻炒2分钟' },
      { step_number: 3, description: '加入韭菜大火翻炒1分钟，加盐和生抽调味' },
    ],
    tips: '韭菜不要炒太久，断生即可', utensils: ['炒锅'],
  },
  {
    name: '红烧茄子', difficulty: 'easy', cook_time_minutes: 20,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '茄子', role: 'main', amount: '2根' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '老抽', role: 'seasoning', amount: '半勺' },
      { name: '白糖', role: 'seasoning', amount: '少许' }, { name: '淀粉', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '茄子切滚刀块，撒盐腌5分钟' },
      { step_number: 2, description: '锅中加油，放茄子煎至软盛出' },
      { step_number: 3, description: '锅中加油放葱姜蒜爆香，加生抽、老抽、糖和少许水' },
      { step_number: 4, description: '放回茄子翻炒，水淀粉勾芡' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '炒菠菜', difficulty: 'easy', cook_time_minutes: 5,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '纯素' },
    ingredients: [
      { name: '菠菜', role: 'main', amount: '1把' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '盐', role: 'seasoning', amount: '适量' }, { name: '食用油', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '菠菜洗净切段' },
      { step_number: 2, description: '热锅加油，放蒜末爆香' },
      { step_number: 3, description: '大火放入菠菜快速翻炒至软，加盐调味' },
    ],
    tips: '菠菜含草酸，可以先焯水', utensils: ['炒锅'],
  },
  {
    name: '醋溜土豆丝', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '土豆', role: 'main', amount: '2个' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '醋', role: 'seasoning', amount: '2勺' }, { name: '盐', role: 'seasoning', amount: '适量' },
      { name: '青椒', role: 'auxiliary', amount: '1个' },
    ],
    steps: [
      { step_number: 1, description: '土豆去皮切细丝，泡水去淀粉沥干' },
      { step_number: 2, description: '热锅加油，放蒜片和青椒丝爆香' },
      { step_number: 3, description: '下土豆丝大火翻炒2分钟' },
      { step_number: 4, description: '加醋和盐调味，翻炒均匀' },
    ],
    tips: '切丝后泡水去淀粉，炒出来更脆', utensils: ['炒锅'],
  },
  {
    name: '凉拌菠菜', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['凉拌'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '纯素' },
    ingredients: [
      { name: '菠菜', role: 'main', amount: '1把' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '1勺' }, { name: '香油', role: 'seasoning', amount: '少许' },
      { name: '盐', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '菠菜洗净，开水焯1分钟捞出过凉水' },
      { step_number: 2, description: '挤干水分切段装盘' },
      { step_number: 3, description: '加蒜末、生抽、香油、盐拌匀' },
    ],
    utensils: [],
  },
  {
    name: '南瓜饼', difficulty: 'medium', cook_time_minutes: 30,
    attributes: { method: ['炸'], spiciness: '不辣', greasiness: '重油', flavor: '带甜', diet_type: '纯素' },
    ingredients: [
      { name: '南瓜', role: 'main', amount: '300g' }, { name: '面粉', role: 'auxiliary', amount: '150g' },
      { name: '白糖', role: 'seasoning', amount: '30g' }, { name: '食用油', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '南瓜去皮蒸熟，压成泥' },
      { step_number: 2, description: '南瓜泥加面粉和白糖揉成面团' },
      { step_number: 3, description: '分成小剂子，压成饼状' },
      { step_number: 4, description: '平底锅放少许油，小火煎至两面金黄' },
    ],
    tips: '南瓜泥要趁热和面', utensils: ['炒锅'],
  },
  {
    name: '蒜蓉炒豆芽', difficulty: 'easy', cook_time_minutes: 8,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '纯素' },
    ingredients: [
      { name: '豆芽', role: 'main', amount: '1把' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '盐', role: 'seasoning', amount: '适量' }, { name: '醋', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '豆芽洗净沥干' },
      { step_number: 2, description: '热锅加油，放蒜末爆香' },
      { step_number: 3, description: '大火放入豆芽翻炒2分钟' },
      { step_number: 4, description: '加盐和少许醋调味' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '胡萝卜炒鸡蛋', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '胡萝卜', role: 'main', amount: '2根' }, { name: '鸡蛋', role: 'main', amount: '2个' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '盐', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '胡萝卜切丝，鸡蛋打散' },
      { step_number: 2, description: '热锅加油，倒入蛋液炒至凝固盛出' },
      { step_number: 3, description: '锅中加油放胡萝卜丝翻炒至软' },
      { step_number: 4, description: '倒回鸡蛋，加盐翻炒均匀' },
    ],
    utensils: ['炒锅'],
  },
  // ====== 汤 (8) ======
  {
    name: '紫菜蛋花汤', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['煮'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '荤素搭配' },
    ingredients: [
      { name: '紫菜', role: 'main', amount: '1块' }, { name: '鸡蛋', role: 'main', amount: '2个' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '盐', role: 'seasoning', amount: '适量' },
      { name: '香油', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '紫菜撕小片，鸡蛋打散' },
      { step_number: 2, description: '锅中加水烧开，放入紫菜煮2分钟' },
      { step_number: 3, description: '慢慢倒入蛋液，不要搅动' },
      { step_number: 4, description: '加盐调味，淋香油，撒葱花' },
    ],
    utensils: ['煮锅'],
  },
  {
    name: '西红柿蛋汤', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['煮'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '西红柿', role: 'main', amount: '2个' }, { name: '鸡蛋', role: 'main', amount: '2个' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '盐', role: 'seasoning', amount: '适量' },
      { name: '香油', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '西红柿切块，鸡蛋打散' },
      { step_number: 2, description: '锅中加油放西红柿翻炒出汁' },
      { step_number: 3, description: '加水大火烧开，煮3分钟' },
      { step_number: 4, description: '慢慢倒入蛋液，加盐调味，淋香油' },
    ],
    utensils: ['煮锅'],
  },
  {
    name: '冬瓜排骨汤', difficulty: 'medium', cook_time_minutes: 60,
    attributes: { method: ['炖'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '荤素搭配' },
    ingredients: [
      { name: '排骨', role: 'main', amount: '400g' }, { name: '冬瓜', role: 'main', amount: '300g' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '料酒', role: 'seasoning', amount: '1勺' },
      { name: '盐', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '排骨冷水下锅焯水，捞出洗净' },
      { step_number: 2, description: '砂锅加水，放入排骨和姜片、料酒，大火烧开转小火炖40分钟' },
      { step_number: 3, description: '加入冬瓜块继续炖15分钟' },
      { step_number: 4, description: '加盐调味，撒葱花' },
    ],
    tips: '小火慢炖汤更清甜', utensils: ['煮锅'],
  },
  {
    name: '酸辣汤', difficulty: 'easy', cook_time_minutes: 20,
    attributes: { method: ['煮'], spiciness: '中辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '豆腐', role: 'auxiliary', amount: '半块' }, { name: '鸡蛋', role: 'main', amount: '2个' },
      { name: '胡萝卜', role: 'auxiliary', amount: '半根' }, { name: '香菇', role: 'auxiliary', amount: '3朵' },
      { name: '醋', role: 'seasoning', amount: '3勺' }, { name: '胡椒粉', role: 'seasoning', amount: '1勺' },
      { name: '淀粉', role: 'seasoning', amount: '2勺' }, { name: '生抽', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '豆腐、胡萝卜、香菇切丝，鸡蛋打散' },
      { step_number: 2, description: '锅中加水烧开，放入所有菜丝煮5分钟' },
      { step_number: 3, description: '加醋、生抽、胡椒粉调味' },
      { step_number: 4, description: '水淀粉勾芡，慢慢倒入蛋液' },
    ],
    tips: '胡椒粉和醋是酸辣的关键', utensils: ['煮锅'],
  },
  {
    name: '玉米排骨汤', difficulty: 'medium', cook_time_minutes: 60,
    attributes: { method: ['炖'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '荤素搭配' },
    ingredients: [
      { name: '排骨', role: 'main', amount: '400g' }, { name: '胡萝卜', role: 'auxiliary', amount: '1根' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '料酒', role: 'seasoning', amount: '1勺' },
      { name: '盐', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '排骨焯水洗净，胡萝卜切块' },
      { step_number: 2, description: '砂锅加水放排骨、姜片、料酒，大火烧开转小火炖40分钟' },
      { step_number: 3, description: '加入胡萝卜继续炖15分钟' },
      { step_number: 4, description: '加盐调味' },
    ],
    utensils: ['煮锅'],
  },
  {
    name: '菠菜蛋花汤', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['煮'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '荤素搭配' },
    ingredients: [
      { name: '菠菜', role: 'main', amount: '1把' }, { name: '鸡蛋', role: 'main', amount: '2个' },
      { name: '盐', role: 'seasoning', amount: '适量' }, { name: '香油', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '菠菜洗净切段，鸡蛋打散' },
      { step_number: 2, description: '锅中加水烧开，放入菠菜煮2分钟' },
      { step_number: 3, description: '慢慢倒入蛋液，加盐调味' },
      { step_number: 4, description: '淋香油即可' },
    ],
    utensils: ['煮锅'],
  },
  {
    name: '豆腐汤', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['煮'], spiciness: '不辣', greasiness: '清爽', flavor: '清淡', diet_type: '纯素' },
    ingredients: [
      { name: '豆腐', role: 'main', amount: '1块' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '盐', role: 'seasoning', amount: '适量' }, { name: '香油', role: 'seasoning', amount: '少许' },
      { name: '胡椒粉', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '豆腐切小块' },
      { step_number: 2, description: '锅中加水烧开，放入豆腐煮5分钟' },
      { step_number: 3, description: '加盐、胡椒粉调味' },
      { step_number: 4, description: '撒葱花，淋香油' },
    ],
    utensils: ['煮锅'],
  },
  {
    name: '南瓜汤', difficulty: 'easy', cook_time_minutes: 25,
    attributes: { method: ['煮'], spiciness: '不辣', greasiness: '清爽', flavor: '带甜', diet_type: '纯素' },
    ingredients: [
      { name: '南瓜', role: 'main', amount: '300g' }, { name: '盐', role: 'seasoning', amount: '少许' },
    ],
    steps: [
      { step_number: 1, description: '南瓜去皮去瓢切块' },
      { step_number: 2, description: '锅中加水放入南瓜煮至软烂' },
      { step_number: 3, description: '用勺子压碎南瓜，搅匀' },
      { step_number: 4, description: '加少许盐调味即可' },
    ],
    tips: '南瓜本身有甜味，不需要加糖', utensils: ['煮锅'],
  },
  // ====== 主食 (12) ======
  {
    name: '蛋炒饭', difficulty: 'easy', cook_time_minutes: 10,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '大米', role: 'main', amount: '300g' }, { name: '鸡蛋', role: 'main', amount: '2个' },
      { name: '胡萝卜', role: 'auxiliary', amount: '半根' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '1勺' }, { name: '盐', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '米饭提前煮好放凉，鸡蛋打散，胡萝卜切丁' },
      { step_number: 2, description: '热锅多放油，倒入蛋液快速翻炒成小块' },
      { step_number: 3, description: '加入米饭大火翻炒，压散饭粒' },
      { step_number: 4, description: '加胡萝卜丁、生抽、盐翻炒均匀' },
    ],
    tips: '隔夜饭炒出来更粒粒分明', utensils: ['炒锅'],
  },
  {
    name: '葱油拌面', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['煮'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '纯素' },
    ingredients: [
      { name: '面条', role: 'main', amount: '200g' }, { name: '韭菜', role: 'auxiliary', amount: '1把' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '老抽', role: 'seasoning', amount: '半勺' },
      { name: '白糖', role: 'seasoning', amount: '1勺' }, { name: '食用油', role: 'seasoning', amount: '3勺' },
    ],
    steps: [
      { step_number: 1, description: '韭菜切段，小火慢煎至焦香酥脆，取出备用' },
      { step_number: 2, description: '锅中加油烧热，放入韭菜段小火炸至焦黄' },
      { step_number: 3, description: '加入生抽、老抽、白糖和少许水熬成葱油汁' },
      { step_number: 4, description: '面条煮好捞出，浇上葱油汁拌匀' },
    ],
    tips: '葱油要小火慢熬，急不得', utensils: ['煮锅'],
  },
  {
    name: '炒面', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '面条', role: 'main', amount: '200g' }, { name: '猪肉', role: 'auxiliary', amount: '100g' },
      { name: '白菜', role: 'auxiliary', amount: '几片' }, { name: '胡萝卜', role: 'auxiliary', amount: '半根' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '老抽', role: 'seasoning', amount: '半勺' },
    ],
    steps: [
      { step_number: 1, description: '面条煮至八成熟捞出，肉切丝，蔬菜切丝' },
      { step_number: 2, description: '热锅下肉丝炒变色，加蔬菜翻炒' },
      { step_number: 3, description: '放入面条，加生抽、老抽翻炒均匀' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '饺子', difficulty: 'hard', cook_time_minutes: 60,
    attributes: { method: ['煮'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '面粉', role: 'main', amount: '300g' }, { name: '猪肉', role: 'main', amount: '200g' },
      { name: '白菜', role: 'main', amount: '半颗' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '香油', role: 'seasoning', amount: '1勺' },
      { name: '料酒', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '面粉加水揉成面团，醒面30分钟' },
      { step_number: 2, description: '白菜切碎撒盐杀水，肉切末加葱姜蒜、生抽、香油、料酒调馅' },
      { step_number: 3, description: '面团搓条切剂子，擀成圆形饺子皮' },
      { step_number: 4, description: '包入馅料，捏成饺子形状' },
      { step_number: 5, description: '大火烧开水，下饺子煮至浮起，点三次凉水' },
    ],
    tips: '面团要醒够时间，包的时候皮中间厚边缘薄', utensils: ['煮锅'],
  },
  {
    name: '西红柿鸡蛋面', difficulty: 'easy', cook_time_minutes: 20,
    attributes: { method: ['煮'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '面条', role: 'main', amount: '200g' }, { name: '西红柿', role: 'main', amount: '2个' },
      { name: '鸡蛋', role: 'main', amount: '2个' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '盐', role: 'seasoning', amount: '适量' }, { name: '生抽', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '西红柿切块，鸡蛋打散炒熟盛出' },
      { step_number: 2, description: '锅中加油放西红柿炒出汁，加水烧开' },
      { step_number: 3, description: '下面条煮至熟透，加入炒好的鸡蛋' },
      { step_number: 4, description: '加盐和生抽调味' },
    ],
    utensils: ['煮锅'],
  },
  {
    name: '炸酱面', difficulty: 'medium', cook_time_minutes: 30,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '面条', role: 'main', amount: '200g' }, { name: '猪肉', role: 'main', amount: '200g' },
      { name: '黄瓜', role: 'auxiliary', amount: '1根' }, { name: '豆芽', role: 'auxiliary', amount: '1把' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '生抽', role: 'seasoning', amount: '2勺' },
      { name: '豆瓣酱', role: 'seasoning', amount: '2勺' },
    ],
    steps: [
      { step_number: 1, description: '猪肉切小丁，黄瓜切丝，豆芽焯水' },
      { step_number: 2, description: '锅中放油，放肉丁煸炒出油脂' },
      { step_number: 3, description: '加入豆瓣酱小火慢炒10分钟，加生抽调味' },
      { step_number: 4, description: '面条煮好捞出，浇上炸酱，配上菜码' },
    ],
    tips: '炸酱要小火慢炒，越炒越香', utensils: ['炒锅', '煮锅'],
  },
  {
    name: '煎饼', difficulty: 'medium', cook_time_minutes: 20,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '面粉', role: 'main', amount: '200g' }, { name: '鸡蛋', role: 'main', amount: '2个' },
      { name: '盐', role: 'seasoning', amount: '适量' }, { name: '食用油', role: 'seasoning', amount: '适量' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '面粉加水搅成稀糊状，加盐和葱花' },
      { step_number: 2, description: '平底锅刷薄油，倒入一勺面糊摇匀' },
      { step_number: 3, description: '小火煎至底部金黄，翻面再煎' },
      { step_number: 4, description: '两面金黄即可出锅' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '包子', difficulty: 'hard', cook_time_minutes: 90,
    attributes: { method: ['蒸'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '面粉', role: 'main', amount: '400g' }, { name: '猪肉', role: 'main', amount: '250g' },
      { name: '葱姜蒜', role: 'seasoning', amount: '适量' }, { name: '生抽', role: 'seasoning', amount: '2勺' },
      { name: '料酒', role: 'seasoning', amount: '1勺' }, { name: '香油', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '面粉加酵母和温水揉成面团，发酵至两倍大' },
      { step_number: 2, description: '肉末加葱姜蒜、生抽、料酒、香油调馅' },
      { step_number: 3, description: '面团揉匀分剂子，擀成中间厚边缘薄的皮' },
      { step_number: 4, description: '包入馅料，捏出褶子' },
      { step_number: 5, description: '二次发酵15分钟，水开后大火蒸15分钟，关火焖3分钟' },
    ],
    tips: '蒸好后不要立即开盖，焖3分钟防止塌陷', utensils: ['蒸锅'],
  },
  {
    name: '炒饼', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '面粉', role: 'main', amount: '200g' }, { name: '猪肉', role: 'auxiliary', amount: '100g' },
      { name: '白菜', role: 'auxiliary', amount: '几片' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '面粉加水和成软面团，擀成薄饼，平底锅烙熟' },
      { step_number: 2, description: '烙好的饼切丝' },
      { step_number: 3, description: '锅中加油放肉丝炒变色，加白菜翻炒' },
      { step_number: 4, description: '放入饼丝翻炒，加生抽调味' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '锅贴', difficulty: 'medium', cook_time_minutes: 40,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '面粉', role: 'main', amount: '300g' }, { name: '猪肉', role: 'main', amount: '200g' },
      { name: '韭菜', role: 'main', amount: '1把' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '2勺' }, { name: '香油', role: 'seasoning', amount: '1勺' },
    ],
    steps: [
      { step_number: 1, description: '面粉加水揉面，醒面30分钟' },
      { step_number: 2, description: '肉末加调料调馅，韭菜切碎拌入' },
      { step_number: 3, description: '面团搓条切剂子，擀成椭圆皮，包入馅料对折捏紧' },
      { step_number: 4, description: '平底锅加油摆放锅贴，中火煎至底部金黄' },
      { step_number: 5, description: '加少量水盖盖焖煮至水干，底部酥脆即可' },
    ],
    tips: '水干后听声，嘧嘧声说明底部在变脆', utensils: ['炒锅'],
  },
  {
    name: '葱花鸡蛋饼', difficulty: 'easy', cook_time_minutes: 15,
    attributes: { method: ['炒'], spiciness: '不辣', greasiness: '清爽', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '面粉', role: 'main', amount: '150g' }, { name: '鸡蛋', role: 'main', amount: '2个' },
      { name: '韭菜', role: 'auxiliary', amount: '1把' }, { name: '盐', role: 'seasoning', amount: '适量' },
      { name: '食用油', role: 'seasoning', amount: '适量' },
    ],
    steps: [
      { step_number: 1, description: '面粉加水、鸡蛋、盐和韭菜末搅成糊' },
      { step_number: 2, description: '平底锅刷油，倒入面糊摇匀' },
      { step_number: 3, description: '小火煎至底部定型，翻面煎另一面' },
      { step_number: 4, description: '两面金黄即可' },
    ],
    utensils: ['炒锅'],
  },
  {
    name: '红烧牛肉面', difficulty: 'hard', cook_time_minutes: 120,
    attributes: { method: ['炖'], spiciness: '微辣', greasiness: '适中', flavor: '咸鲜', diet_type: '荤素搭配' },
    ingredients: [
      { name: '牛肉', role: 'main', amount: '500g' }, { name: '面条', role: 'main', amount: '200g' },
      { name: '胡萝卜', role: 'auxiliary', amount: '1根' }, { name: '葱姜蒜', role: 'seasoning', amount: '适量' },
      { name: '生抽', role: 'seasoning', amount: '3勺' }, { name: '老抽', role: 'seasoning', amount: '1勺' },
      { name: '料酒', role: 'seasoning', amount: '2勺' }, { name: '花椒', role: 'seasoning', amount: '少许' },
      { name: '干辣椒', role: 'seasoning', amount: '3个' },
    ],
    steps: [
      { step_number: 1, description: '牛肉切块焯水，洗净沥干' },
      { step_number: 2, description: '锅中加油放葱姜蒜、花椒、干辣椒爆香' },
      { step_number: 3, description: '放入牛肉翻炒，加生抽、老抽、料酒' },
      { step_number: 4, description: '加开水没过牛肉，大火烧开转小火炖90分钟' },
      { step_number: 5, description: '加入胡萝卜块继续炖20分钟' },
      { step_number: 6, description: '面条煮好，浇上牛肉和汤' },
    ],
    tips: '牛肉要炖够时间才软烂', utensils: ['炒锅', '煮锅'],
  },
];
