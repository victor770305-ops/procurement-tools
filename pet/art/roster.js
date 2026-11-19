/* =====================================================================
   糰糰夥伴 角色名冊（美術來源：pet/art/source/sheet1~4.png，原畫提供者設計）
   20 個家族 × 3 階段 = 60 張去背角色圖，放在 pet/art/creatures/{id}-{stage}.png
   Roster.img(id, stage)  → 圖檔路徑
   Roster.tag(id, stage, {size, cls}) → <img> HTML
   Roster.svgImage(id, stage, x, y, w) → 內嵌在 SVG 場景用的 <image>
   ===================================================================== */
(function (root) {
'use strict';
const FAMILIES = {
  guard:   { name: '守護系', icon: '🛡️', color: '#5B8DEF', desc: '開店、閉店、兌幣等安全類任務' },
  mech:    { name: '機械系', icon: '⚙️', color: '#F2963B', desc: '機台清潔、夾力測試、故障回報' },
  harvest: { name: '豐收系', icon: '📦', color: '#36B368', desc: '補貨、陳列、庫存點檢' },
  kind:    { name: '親和系', icon: '💖', color: '#F06A9B', desc: '協助顧客、會員推廣、環境巡視' },
  wise:    { name: '智慧系', icon: '📘', color: '#8C6CF0', desc: '每日一題、閱讀公告' },
};
const RARITY = { starter: { name: '初始', color: '#36B368' }, common: { name: '普通', color: '#5B8DEF' }, rare: { name: '稀有', color: '#B05CF0' }, legend: { name: '傳說・店寵', color: '#F2A23B' } };

const SPECIES = [
  /* 守護系 */
  { id: 'g1', fam: 'guard', rare: 'starter', src: 's3r2', family: '鋼殼龜', element: '鋼鐵・要塞',
    names: ['鉚釘龜', '鐵背龜', '神盾要塞龜'], en: ['Rivetot', 'Ironback', 'Aegistort'],
    concept: '背殼一片片鍛造加固的鋼殼龜，就像門市的安全防線。最終背著齒輪城門與旗幟，成為移動要塞。' },
  { id: 'g2', fam: 'guard', rare: 'common', src: 's1r5', family: '石英甲蟲', element: '岩石・礦物',
    names: ['小石犀', '岩角犀', '巨晶要塞犀'], en: ['Pebblin', 'Granhorn', 'Titanquartz'],
    concept: '會收集礦石的犀角甲蟲，越長越堅固，最後全身長滿紫水晶，成為活的水晶堡壘。' },
  { id: 'g3', fam: 'guard', rare: 'rare', src: 's2r2', family: '影月貓', element: '暗影・月',
    names: ['夜夜喵', '影爪豹', '蝕月獅'], en: ['Nocti', 'Umbrawl', 'Eclipsemane'],
    concept: '在夜裡無聲巡邏的影子貓，額頭有月牙印記。閉店後守著門市，最終化為披著月蝕鬃毛的獅子。' },
  { id: 'g4', fam: 'guard', rare: 'legend', src: 's4r1', family: '沙丘鼴獅', element: '大地・沙',
    names: ['沙沙鼴', '掘吼獅', '沙丘巨像'], en: ['Dustrit', 'Burroar', 'Dunecoloss'],
    concept: '結合鼴鼠的挖掘本領與獅子的威嚴，最終背負古老遺跡，成為守護整座牧場的沙丘巨像。' },
  /* 機械系 */
  { id: 'm1', fam: 'mech', rare: 'starter', src: 's4r5', family: '發明家浣熊', element: '機械・科技',
    names: ['小工浣熊', '機關浣熊', '機甲俠盜'], en: ['Scrappit', 'Gadgetit', 'Mechabandit'],
    concept: '戴著護目鏡、隨身帶工具箱的小浣熊，最愛修理機台。最終穿上機甲、揮動機械臂，成為工程英雄。' },
  { id: 'm2', fam: 'mech', rare: 'common', src: 's1r2', family: '焰鱗穿山甲', element: '火焰',
    names: ['火星鱗', '焰爪鱗', '煉獄鱗王'], en: ['Cindlet', 'Flareclaw', 'Inferazor'],
    concept: '鱗片像鍛造爐一樣儲存熱能的穿山甲，越長大火焰越旺，象徵機台全速運轉的熱力。' },
  { id: 'm3', fam: 'mech', rare: 'rare', src: 's1r4', family: '雷暴猞猁', element: '電',
    names: ['電電貂', '閃光猞猁', '雷霆獸'], en: ['Voltup', 'Sparklynx', 'Thundrake'],
    concept: '靠靜電充飽活力的小貂，掌管全店機台的電力，最終成為呼風喚雷的雷霆獸。' },
  { id: 'm4', fam: 'mech', rare: 'legend', src: 's3r1', family: '火山角羊蜥', element: '火・熔岩',
    names: ['焰焰羊', '熔岩角羊', '熔核巨角'], en: ['Emberaa', 'Vulkram', 'Magmashorn'],
    concept: '體內流著熔岩的角羊蜥，熱力永不熄滅，是機械系的傳說店寵。' },
  /* 豐收系 */
  { id: 'h1', fam: 'harvest', rare: 'starter', src: 's3r5', family: '花開羊駝', element: '自然・花',
    names: ['花花羊駝', '玫瑰羊駝', '花冠女王'], en: ['Petali', 'Roselamb', 'Bloompress'],
    concept: '毛裡會開花的羊駝，把貨架照顧得像花園一樣漂亮。最終頭戴花冠，全身綻放牡丹與藤蔓。' },
  { id: 'h2', fam: 'harvest', rare: 'common', src: 's2r4', family: '毒鱗變色龍', element: '毒・適應',
    names: ['斑斑蜥', '毒牙蜥', '瘴霧龍'], en: ['Toxlet', 'Venofang', 'Miasmara'],
    concept: '會變換顏色的變色龍，擅長融入環境，是陳列擺設的高手。' },
  { id: 'h3', fam: 'harvest', rare: 'rare', src: 's2r5', family: '霜行冰狼', element: '冰',
    names: ['冰冰海豹', '冰川狼', '極光狼王'], en: ['Fribby', 'Glacero', 'Polarisk'],
    concept: '能讓空氣結晶成冰的海豹狼，負責把庫存保持在最新鮮的狀態，最終背負極光。' },
  { id: 'h4', fam: 'harvest', rare: 'legend', src: 's1r1', family: '森靈貓', element: '草・自然',
    names: ['苔苔貓', '荊棘貓', '森林之王'], en: ['Mosskit', 'Thornpounce', 'Verdant Rex'],
    concept: '與森林一起長大的貓狐，身上纏繞著活生生的植物，是豐收系的傳說店寵。' },
  /* 親和系 */
  { id: 'k1', fam: 'kind', rare: 'starter', src: 's1r3', family: '水精螈', element: '水',
    names: ['泡泡螈', '浪花螈', '海神螈'], en: ['Bubblit', 'Tideroo', 'Leviaplush'],
    concept: '愛吐泡泡的六角恐龍，笑容讓每位顧客放鬆。最終成為戴著珍珠項鍊的溫柔海神。' },
  { id: 'k2', fam: 'kind', rare: 'common', src: 's3r4', family: '音律羚', element: '聲音・音樂',
    names: ['音音兔', '節奏羚', '樂章女王'], en: ['Tunbun', 'Rhythmoo', 'Soniqueen'],
    concept: '戴著耳機的兔羚，跟著音樂的節奏移動，讓門市充滿歡樂的氣氛。' },
  { id: 'k3', fam: 'kind', rare: 'rare', src: 's4r4', family: '幽靈水母', element: '靈・幽',
    names: ['啵啵水母', '燈靈水母', '引路幽光'], en: ['Gloopuff', 'Spectrelly', 'Phantafloat'],
    concept: '溫柔漂浮的水母精靈，提著燈籠為迷路的人引路，就像主動協助顧客的夥伴。' },
  { id: 'k4', fam: 'kind', rare: 'legend', src: 's2r1', family: '天幕風兔', element: '風・天空',
    names: ['風風兔', '疾風兔', '天嵐神狐'], en: ['Breebit', 'Galehare', 'Tempestra'],
    concept: '乘著風奔跑的兔狐，輕盈的身體能聚集風暴之力，是親和系的傳說店寵。' },
  /* 智慧系 */
  { id: 'w1', fam: 'wise', rare: 'starter', src: 's3r3', family: '靈視鴞貓', element: '超能・靈',
    names: ['咕咕鴞貓', '心靈鴞', '先知神鴞'], en: ['Hootle', 'Mindowl', 'Oracleon'],
    concept: '能看見無形事物的鴞貓，什麼 SOP 都記得。最終展開羽翼，成為身邊環繞符文的先知。' },
  { id: 'w2', fam: 'wise', rare: 'common', src: 's4r3', family: '晶晶守宮龍', element: '水晶・龍',
    names: ['晶晶守宮', '晶鋼龍', '稜鏡龍'], en: ['Gemble', 'Crysteel', 'Prismadon'],
    concept: '身上長出水晶的守宮，每學到一件事水晶就更閃亮，最終把光折射成彩虹。' },
  { id: 'w3', fam: 'wise', rare: 'rare', src: 's4r2', family: '風暴虎鯨', element: '水・風暴',
    names: ['浪浪鯨', '風暴虎鯨', '颶風鯨王'], en: ['Splashfin', 'Tempestide', 'Cyclorca'],
    concept: '聰明又愛玩的小虎鯨，最終成為駕馭風暴的鯨王。' },
  { id: 'w4', fam: 'wise', rare: 'legend', src: 's2r3', family: '光輝靈鹿', element: '光・星辰',
    names: ['光光鹿', '日輝鹿', '星角聖鹿'], en: ['Lumini', 'Solara', 'Astrahorn'],
    concept: '鹿角能引導陽光與星辰祝福的靈鹿，是智慧系的傳說店寵。' },
];
const BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));
let BASE = (root.ROSTER_BASE !== undefined) ? root.ROSTER_BASE : '';
const img = (id, stage) => `${BASE}creatures/${id}-${stage}.png`;
const tag = (id, stage, o = {}) => { const s = BY_ID[id]; return `<img src="${img(id, stage)}" alt="${s ? s.names[stage - 1] : ''}" class="${o.cls || 'roster-img'}" loading="lazy" draggable="false">`; };
const svgImage = (id, stage, x, y, w, h) => `<image href="${img(id, stage)}" x="${x}" y="${y}" width="${w}" height="${h || w}" preserveAspectRatio="xMidYMax meet"/>`;
root.Roster = { FAMILIES, RARITY, SPECIES, byId: id => BY_ID[id], img, tag, svgImage, setBase: b => { BASE = b; } };
})(typeof window !== 'undefined' ? window : globalThis);
