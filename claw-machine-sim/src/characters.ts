/** 人物設定:老闆、店員、常客、隨機顧客各有獨立的姓名、職位、簡介、個性、外觀與六項能力。
 *  3D 小人與肖像都由同一份 Look 產生,所以兩者長得一致。 */
export type Role = 'boss' | 'staff' | 'customer';
export type ArchKind = 'student' | 'couple' | 'pro' | 'kid';

export interface Look {
  skin: number;
  hair: number;
  hairStyle: 'short' | 'long' | 'pony' | 'bun' | 'curly' | 'bald';
  glasses?: boolean;
  face: 'round' | 'oval' | 'square';
  eyes: 'round' | 'narrow' | 'big';
  brows: 'thin' | 'thick' | 'flat';
  mouth: 'smile' | 'neutral' | 'grin';
  outfit: 'uniform' | 'suit' | 'hoodie' | 'tee' | 'jacket' | 'dress';
  shirt: number;
  extra?: 'cap' | 'bow' | 'headband' | 'beard' | 'blush';
}

export interface Character {
  id: string;
  name: string;
  role: Role;
  /** 職位或身分 */
  title: string;
  age: number;
  gender: 'f' | 'm';
  bio: string;
  quirks: string[];
  look: Look;
  /** 六項能力,0~100 */
  stats: number[];
  statNames: string[];
  accent: number;
  /** 常客專用 */
  regular?: boolean;
  kind?: ArchKind;
  occupation?: string;
}

export const STAFF_STATS = ['速度', '細心', '技術', '親和', '體力', '抗壓'];
export const BOSS_STATS = ['營收力', '口碑', '現金流', '人事', '設備', '庫存'];
export const CUSTOMER_STATS = ['技術', '預算', '耐心', '運氣', '收藏慾', '社交'];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// ---------- 老闆 ----------
export const BOSS: Character = {
  id: 'boss',
  name: '林建宏',
  role: 'boss',
  title: '店長兼老闆',
  age: 45,
  gender: 'm',
  bio: '前電子廠工程師。女兒從小愛夾娃娃,他乾脆自己開了一間,立志把「夾娃娃樂園」做成全區最有人情味的店。',
  quirks: ['愛算帳', '老爸笑話', '每天巡店三圈'],
  look: { skin: 0xe6b894, hair: 0x2a2622, hairStyle: 'short', glasses: true, face: 'square', eyes: 'narrow', brows: 'thick', mouth: 'smile', outfit: 'suit', shirt: 0x26324a },
  stats: [50, 50, 50, 50, 50, 50],
  statNames: BOSS_STATS,
  accent: 0xf0c04a,
};

// ---------- 店員 ----------
type StaffDef = Omit<Character, 'role'> & { role?: 'staff'; shift: 0 | 1 };
const STAFF_RAW: StaffDef[] = [
  {
    id: 'kai', shift: 0, name: '阿凱', role: 'staff', title: '資深理貨員', age: 28, gender: 'm', accent: 0x38d0ff,
    bio: '做了五年的老員工,搬貨與跑腿速度全店第一,只是做事有點毛躁,偶爾會忘記擦玻璃。',
    quirks: ['跑腿王', '早起鳥', '手搖飲重度成癮'],
    look: { skin: 0xdfae88, hair: 0x1a1512, hairStyle: 'short', face: 'square', eyes: 'round', brows: 'thick', mouth: 'grin', outfit: 'uniform', shirt: 0x24506b },
    stats: [88, 52, 60, 55, 82, 68], statNames: STAFF_STATS,
  },
  {
    id: 'wen', shift: 0, name: '小雯', role: 'staff', title: '客服專員', age: 24, gender: 'f', accent: 0x38d0ff,
    bio: '笑起來有兩個酒窩,最擅長安撫連輸的客人。記得每位常客的名字,是店裡的人氣王。',
    quirks: ['天生笑臉', '記得常客名字', '怕蟲'],
    look: { skin: 0xf2cdb0, hair: 0x6b4426, hairStyle: 'pony', face: 'round', eyes: 'big', brows: 'thin', mouth: 'smile', outfit: 'uniform', shirt: 0x24506b, extra: 'blush' },
    stats: [60, 72, 45, 92, 58, 70], statNames: STAFF_STATS,
  },
  {
    id: 'mei', shift: 0, name: '小美', role: 'staff', title: '資深店員', age: 35, gender: 'f', accent: 0x38d0ff,
    bio: '十年老將,做事滴水不漏,新人的導師。店裡的規矩有一半是她定的。',
    quirks: ['滴水不漏', '新人導師', '隨身帶酒精濕紙巾'],
    look: { skin: 0xf0c8aa, hair: 0x3a2418, hairStyle: 'long', face: 'oval', eyes: 'narrow', brows: 'thin', mouth: 'neutral', outfit: 'uniform', shirt: 0x24506b },
    stats: [55, 90, 70, 75, 50, 88], statNames: STAFF_STATS,
  },
  {
    id: 'wei', shift: 0, name: '大偉', role: 'staff', title: '維修技師', age: 41, gender: 'm', accent: 0x38d0ff,
    bio: '本來是機電工程師,轉行來修娃娃機。再怪的故障他都能找到原因,話不多,但修好時會偷偷得意。',
    quirks: ['機台醫生', '話少', '隨身螺絲起子'],
    look: { skin: 0xc68863, hair: 0x2a2a30, hairStyle: 'short', glasses: true, face: 'square', eyes: 'narrow', brows: 'flat', mouth: 'neutral', outfit: 'uniform', shirt: 0x24506b },
    stats: [48, 76, 95, 40, 62, 80], statNames: STAFF_STATS,
  },
  {
    id: 'yu', shift: 1, name: '小宇', role: 'staff', title: '工讀生', age: 20, gender: 'm', accent: 0xff7ad0,
    bio: '大三的工讀生,體力好、愛打球,但經驗少,遇到突發狀況容易慌。',
    quirks: ['體育系', '容易緊張', '下班一定去打球'],
    look: { skin: 0xf3d4bc, hair: 0x2a2a30, hairStyle: 'short', face: 'oval', eyes: 'round', brows: 'thick', mouth: 'grin', outfit: 'uniform', shirt: 0x4b3a6b },
    stats: [80, 40, 35, 62, 90, 38], statNames: STAFF_STATS,
  },
  {
    id: 'shan', shift: 1, name: '佩珊', role: 'staff', title: '理貨主任', age: 31, gender: 'f', accent: 0xff7ad0,
    bio: '管貨很嚴格,倉庫的數字永遠對得上。她的口頭禪是「貨不會自己長腳」。',
    quirks: ['數字控', '倉庫女王', '討厭亂放'],
    look: { skin: 0xe2ae88, hair: 0x1a1512, hairStyle: 'bun', face: 'round', eyes: 'narrow', brows: 'thin', mouth: 'neutral', outfit: 'uniform', shirt: 0x4b3a6b },
    stats: [66, 92, 55, 58, 64, 72], statNames: STAFF_STATS,
  },
  {
    id: 'hao', shift: 1, name: '志豪', role: 'staff', title: '夜班技師', age: 33, gender: 'm', accent: 0xff7ad0,
    bio: '戴眼鏡的夜班技師,下班後還會在家拆機台零件研究。同事都說他是「機台語言翻譯機」。',
    quirks: ['愛拆東西', '眼鏡仔', '半夜才有精神'],
    look: { skin: 0xc68863, hair: 0x1a1512, hairStyle: 'short', glasses: true, face: 'oval', eyes: 'round', brows: 'flat', mouth: 'smile', outfit: 'uniform', shirt: 0x4b3a6b },
    stats: [52, 70, 88, 45, 60, 66], statNames: STAFF_STATS,
  },
  {
    id: 'ting', shift: 1, name: '雅婷', role: 'staff', title: '資深客服', age: 29, gender: 'f', accent: 0xff7ad0,
    bio: '能言善道,客訴一到她手上都能變成誇獎。再難搞的客人也會被她逗笑。',
    quirks: ['金牌嘴砲', '情緒穩定', '愛追劇'],
    look: { skin: 0xf2cdb0, hair: 0xb9873a, hairStyle: 'long', face: 'oval', eyes: 'big', brows: 'thin', mouth: 'smile', outfit: 'uniform', shirt: 0x4b3a6b, extra: 'blush' },
    stats: [58, 65, 48, 90, 55, 84], statNames: STAFF_STATS,
  },
];
export const STAFF_DEFS = STAFF_RAW.map((d) => ({ ...d, role: 'staff' as const })) as (Character & { shift: 0 | 1 })[];

// ---------- 常客 ----------
export const REGULARS: Character[] = [
  {
    id: 'r-ama', name: '林秀蘭', role: 'customer', regular: true, kind: 'couple', title: '常客・阿嬤', age: 68, gender: 'f', accent: 0xf29ac0, occupation: '退休老師',
    bio: '大家都叫她阿嬤。每週三帶孫子來,專挑熊熊娃娃,夾不到也不生氣,總是笑咪咪地請店員幫忙。',
    quirks: ['愛熊熊', '帶孫子', '自備零錢袋'],
    look: { skin: 0xf0c8aa, hair: 0xb8b8c0, hairStyle: 'bun', glasses: true, face: 'round', eyes: 'narrow', brows: 'thin', mouth: 'smile', outfit: 'jacket', shirt: 0x9a5aa0 },
    stats: [30, 60, 95, 70, 70, 85], statNames: CUSTOMER_STATS,
  },
  {
    id: 'r-jie', name: '小傑', role: 'customer', regular: true, kind: 'student', title: '常客・國中生', age: 14, gender: 'm', accent: 0x58b0ff, occupation: '國中生',
    bio: '放學一定來報到,夢想是當職業夾娃娃選手。零用錢都花在這裡,偶爾會被媽媽唸。',
    quirks: ['夢想職業選手', '零用錢殺手', '會自言自語'],
    look: { skin: 0xe4b48e, hair: 0x1a1512, hairStyle: 'short', face: 'round', eyes: 'big', brows: 'thick', mouth: 'grin', outfit: 'hoodie', shirt: 0x3b6fd1 },
    stats: [55, 35, 40, 50, 30, 70], statNames: CUSTOMER_STATS,
  },
  {
    id: 'r-ming', name: '陳志明', role: 'customer', regular: true, kind: 'pro', title: '常客・上班族', age: 32, gender: 'm', accent: 0x6c7a99, occupation: '工程師',
    bio: '下班來解壓,技術一流,但面子很重,被店員幫忙會有點不好意思。口頭禪是「這台爪力有問題」。',
    quirks: ['愛面子', '技術流', '西裝不脫'],
    look: { skin: 0xdfae88, hair: 0x2a2a30, hairStyle: 'short', glasses: true, face: 'oval', eyes: 'narrow', brows: 'flat', mouth: 'neutral', outfit: 'jacket', shirt: 0x3d4757 },
    stats: [88, 75, 50, 45, 60, 40], statNames: CUSTOMER_STATS,
  },
  {
    id: 'r-zhen', name: '黃小蓁', role: 'customer', regular: true, kind: 'couple', title: '常客・設計師', age: 26, gender: 'f', accent: 0xf29ac0, occupation: '平面設計師',
    bio: '專門幫男朋友夾稀有款,挑娃娃的眼光很準。每次都先在機台前研究五分鐘才下手。',
    quirks: ['稀有款獵人', '愛拍照', '研究派'],
    look: { skin: 0xf3d4bc, hair: 0x6b4426, hairStyle: 'long', face: 'oval', eyes: 'big', brows: 'thin', mouth: 'smile', outfit: 'dress', shirt: 0xd9759d, extra: 'blush' },
    stats: [48, 70, 75, 65, 92, 80], statNames: CUSTOMER_STATS,
  },
  {
    id: 'r-xuan', name: '陳小萱', role: 'customer', regular: true, kind: 'kid', title: '常客・小學生', age: 7, gender: 'f', accent: 0xffd45e, occupation: '小學生',
    bio: '跟著爸爸來的小女生,眼睛只盯著兔兔娃娃。夾到時會開心得原地轉圈圈。',
    quirks: ['兔兔控', '愛轉圈', '很有禮貌'],
    look: { skin: 0xf5d6bd, hair: 0x3a2418, hairStyle: 'pony', face: 'round', eyes: 'big', brows: 'thin', mouth: 'grin', outfit: 'tee', shirt: 0xf2b93a, extra: 'bow' },
    stats: [15, 25, 60, 80, 85, 90], statNames: CUSTOMER_STATS,
  },
  {
    id: 'r-wang', name: '王大哥', role: 'customer', regular: true, kind: 'pro', title: '常客・退休司機', age: 54, gender: 'm', accent: 0x6c7a99, occupation: '退休計程車司機',
    bio: '自稱破解了爪力規律,逢人就分享心得。其實只是運氣不錯,但大家都愛聽他講。',
    quirks: ['愛分享心得', '自封高手', '愛聊天'],
    look: { skin: 0xc68863, hair: 0x8a8a90, hairStyle: 'short', face: 'square', eyes: 'narrow', brows: 'thick', mouth: 'grin', outfit: 'tee', shirt: 0x394f3a, extra: 'cap' },
    stats: [82, 80, 70, 40, 45, 75], statNames: CUSTOMER_STATS,
  },
  {
    id: 'r-xiang', name: '張阿翔', role: 'customer', regular: true, kind: 'student', title: '常客・直播主', age: 22, gender: 'm', accent: 0xb57bff, occupation: '直播主',
    bio: '邊夾邊直播的大學生,觀眾愛看他夾不到時的搞笑反應。偶爾會把整個店面拍進去。',
    quirks: ['邊玩邊直播', '戲劇化反應', '手機不離手'],
    look: { skin: 0xe9c1a0, hair: 0x6b4426, hairStyle: 'curly', face: 'oval', eyes: 'big', brows: 'thin', mouth: 'grin', outfit: 'hoodie', shirt: 0x8f74c8 },
    stats: [60, 55, 35, 55, 50, 95], statNames: CUSTOMER_STATS,
  },
  {
    id: 'r-zhen2', name: '吳美珍', role: 'customer', regular: true, kind: 'couple', title: '常客・媽媽團團長', age: 38, gender: 'f', accent: 0xf29ac0, occupation: '全職媽媽',
    bio: '媽媽團的團長,一出手就是一整團人。出手大方,最喜歡店員記得她小孩的名字。',
    quirks: ['一次帶一團', '出手大方', '社交女王'],
    look: { skin: 0xf0c8aa, hair: 0x2a2a30, hairStyle: 'short', face: 'round', eyes: 'round', brows: 'thin', mouth: 'smile', outfit: 'jacket', shirt: 0xdf9a3e },
    stats: [38, 85, 70, 60, 65, 92], statNames: CUSTOMER_STATS,
  },
];

// ---------- 隨機顧客 ----------
const SURNAMES = ['陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊', '許', '鄭', '謝', '郭', '洪', '邱'];
const GIVEN_F = ['怡君', '雅婷', '欣怡', '詩涵', '宜庭', '雨柔', '姿穎', '語彤', '芷晴', '子萱'];
const GIVEN_M = ['志明', '家豪', '俊傑', '冠宇', '承恩', '柏翰', '宗翰', '彥廷', '哲瑋', '品睿'];
const GIVEN_KID = ['小安', '小恩', '安安', '樂樂', '小禾', '小宇'];
const OCC: Record<ArchKind, string[]> = {
  student: ['高中生', '大學生', '國中生', '研究生'],
  couple: ['上班族', '設計師', '護理師', '咖啡師', '行銷企劃'],
  pro: ['計程車司機', '倉管', '廚師', '自由業', '退休人員'],
  kid: ['小學生', '幼稚園學生'],
};
const BIO: Record<ArchKind, (a: number, o: string) => string> = {
  student: (a, o) => `${a} 歲的${o},下課後最愛來夾娃娃紓壓。`,
  couple: (a, o) => `${a} 歲的${o},假日喜歡跟另一半約會夾娃娃。`,
  pro: (a, o) => `${a} 歲的${o},自認是夾娃娃高手,最愛研究機台的爪力。`,
  kid: (a, o) => `${a} 歲的${o},被爸媽帶來,眼睛一直盯著最大的娃娃。`,
};
const QUIRKS = ['愛喝手搖', '只夾稀有款', '輸了會碎碎念', '贏了會尖叫', '自備零錢', '會拍影片', '很有禮貌', '喜歡聊天', '怕吵', '愛殺價', '手氣玄學'];
const SKINS = [0xf1c9a5, 0xe0ac86, 0xc68863, 0x8d5a3b, 0xf5d6bd];
const HAIRS = [0x1a1512, 0x3a2418, 0x6b4426, 0x2a2a30, 0xb9873a];

/** 各類客人的基準能力(0~100):技術 預算 耐心 運氣 收藏慾 社交 */
const BASE: Record<ArchKind, number[]> = {
  student: [40, 40, 55, 50, 25, 70],
  couple: [50, 60, 70, 50, 60, 75],
  pro: [90, 75, 40, 45, 80, 35],
  kid: [20, 25, 70, 60, 15, 85],
};
const SHIRTS: Record<ArchKind, number[]> = {
  student: [0x3b6fd1, 0x2f8f6a, 0xc24b47, 0x56606e],
  couple: [0xd9759d, 0x8f74c8, 0xdf9a3e, 0xe8e2d4],
  pro: [0x2a313c, 0x3d4757, 0x5c3d2e, 0x394f3a],
  kid: [0xf2b93a, 0x5cb6e8, 0xf07a7a, 0x7bc88a],
};

export function genCustomer(kind: ArchKind): Character {
  const gender: 'f' | 'm' = Math.random() < 0.5 ? 'f' : 'm';
  const age = kind === 'student' ? Math.round(rnd(14, 24)) : kind === 'couple' ? Math.round(rnd(22, 36)) : kind === 'pro' ? Math.round(rnd(26, 58)) : Math.round(rnd(6, 11));
  const occ = pick(OCC[kind]);
  const given = kind === 'kid' ? pick(GIVEN_KID) : gender === 'f' ? pick(GIVEN_F) : pick(GIVEN_M);
  const long = gender === 'f' && Math.random() < 0.7;
  const accessoryCap = kind === 'pro' && Math.random() < 0.4;
  const stats = BASE[kind].map((v) => clamp(Math.round(v + rnd(-18, 18))));
  const outfit: Look['outfit'] = kind === 'student' ? pick(['hoodie', 'tee'] as const) : kind === 'couple' ? pick(['jacket', 'tee', ...(gender === 'f' ? (['dress'] as const) : [])] as const) : kind === 'pro' ? pick(['jacket', 'tee'] as const) : 'tee';
  const quirks = [pick(QUIRKS), pick(QUIRKS)].filter((q, i, a) => a.indexOf(q) === i);
  return {
    id: `c-${Math.random().toString(36).slice(2, 9)}`,
    name: pick(SURNAMES) + given,
    role: 'customer',
    kind,
    title: { student: '學生客', couple: '情侶客', pro: '老手', kid: '小朋友' }[kind],
    age,
    gender,
    occupation: occ,
    bio: BIO[kind](age, occ),
    quirks,
    accent: { student: 0x58b0ff, couple: 0xf29ac0, pro: 0x6c7a99, kid: 0xffd45e }[kind],
    look: {
      skin: pick(SKINS),
      hair: pick(HAIRS),
      hairStyle: kind === 'kid' ? pick(['pony', 'short', 'bun'] as const) : long ? pick(['long', 'long', 'pony'] as const) : pick(['short', 'short', 'curly', 'bald'] as const),
      glasses: kind !== 'kid' && Math.random() < 0.18,
      face: pick(['round', 'oval', 'square'] as const),
      eyes: pick(['round', 'narrow', 'big'] as const),
      brows: pick(['thin', 'thick', 'flat'] as const),
      mouth: pick(['smile', 'smile', 'grin', 'neutral'] as const),
      outfit,
      shirt: pick(SHIRTS[kind]),
      extra: accessoryCap ? 'cap' : kind === 'kid' ? (gender === 'f' ? 'bow' : undefined) : gender === 'f' && Math.random() < 0.4 ? 'blush' : undefined,
    },
    stats,
    statNames: CUSTOMER_STATS,
  };
}
