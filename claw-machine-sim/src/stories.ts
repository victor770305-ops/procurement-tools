import type { Modifier } from './economy';

/** 日常營運劇情案例:每張卡有角色、情境與 2~3 個選項,選項有代價也有後果。 */
export type ModSpec = Omit<Modifier, 'id'>;

export type Eff =
  | { cash: number }
  | { rep: number }
  | { mod: ModSpec }
  | { flag: string }
  | { morale: { who: string; delta: number } }
  | { leave: { who: string; days: number } }
  | { trait: { who: string; stat: number; delta: number } }
  | { stock: number; rare?: boolean }
  | { chain: { id: string; after: number } };

export interface Ctx {
  rep: number;
  /** 全店平均髒污 0~1 */
  dirt: number;
  faults: number;
  cash: number;
  day: number;
  /** 當班的店員人數 */
  crew: number;
}

export interface Branch {
  /** 發生機率,可依店況計算 */
  p: number | ((c: Ctx) => number);
  outcome: string;
  effects: Eff[];
}

export interface Choice {
  label: string;
  hint: string;
  /** 結果:一個或多個機率分支(最後一個分支是保底) */
  branches: Branch[];
}

export interface Story {
  id: string;
  slot: 'morning' | 'midday' | 'evening';
  icon: string;
  tag: string;
  title: string;
  /** 出場角色(人物設定的 id) */
  cast: string[];
  body: string[];
  choices: Choice[];
  weight?: number;
  when?: (c: Ctx, flags: string[]) => boolean;
  /** 只會由其他劇情的後續觸發 */
  chainOnly?: boolean;
}

const one = (outcome: string, effects: Eff[]): Branch[] => [{ p: 1, outcome, effects }];

export const STORIES: Story[] = [
  // ======================= 開幕 =======================
  {
    id: 'intro', slot: 'morning', icon: '🎉', tag: '開幕第一天', title: '夾娃娃樂園,今天開張', cast: ['boss', 'kai', 'wen'], weight: 1000, chainOnly: true,
    body: [
      '早上九點半,老闆林建宏站在 60 台嶄新的娃娃機前,手心有點出汗。這是他辭掉工程師工作後的第一個大案子。',
      '阿凱已經把倉庫整理好了,小雯正在擦玻璃,笑著說:「老闆,放輕鬆,我們一定會把店顧好。」',
      '「今天,我們要用什麼姿態迎接第一批客人?」',
    ],
    choices: [
      { label: '主打親民價格', hint: '開幕週客流 +15%(3 天)', branches: one('門口貼出「開幕體驗價」的紅紙,路過的學生探頭探腦。下午開始,店裡的人潮比想像中多。', [{ mod: { label: '開幕體驗價', days: 3, arrival: 1.15 } }]) },
      { label: '主打貼心服務', hint: '客人心情 +,士氣 +10%(3 天)', branches: one('小雯和阿凱在門口發手工小卡,客人進門就收到一句「歡迎光臨」。員工們也跟著打起精神。', [{ mod: { label: '貼心服務週', days: 3, mood: 0.1 } }, { morale: { who: 'all', delta: 0.1 } }]) },
      { label: '低調營運,先觀察', hint: '不影響客流,省下開幕開銷', branches: one('老闆決定先看看店裡的實際狀況。一整天安安靜靜,但也沒出什麼亂子。', [{ cash: 500 }]) },
    ],
  },
  // ======================= 早上 =======================
  {
    id: 'vendor-sample', slot: 'morning', icon: '📦', tag: '進貨商機', title: '廠商帶來限量聯名娃娃', cast: ['boss', 'mei'], weight: 3,
    body: ['進貨業務張經理一早就來了,從紙箱裡掏出一隻亮晶晶的聯名限量娃娃。', '「老闆,這款下週才會上市,只有我們這區的店能先拿到。一隻成本比一般款貴一點,但客人一定搶著夾。」', '小美在旁邊算了一下庫存:「老闆,如果要訂,今天就要決定。」'],
    choices: [
      { label: '訂 60 隻限量款', hint: '現金 -6,000;倉庫 +60 隻(稀有款為主);客流 +20%(2 天)', branches: one('張經理笑得合不攏嘴。限量款一上架,客人圍在機台前拍照,社群上也出現了「這家有限量款」的貼文。', [{ cash: -6000 }, { stock: 60, rare: true }, { mod: { label: '限量款話題', days: 2, arrival: 1.2 } }]) },
      { label: '只拿 8 隻試擺', hint: '現金 -500;倉庫 +8 隻;聲望 +0.05', branches: one('老闆先拿了一小批放在最顯眼的機台,客人反應不錯,但很快就被夾光了。', [{ cash: -500 }, { stock: 8, rare: true }, { rep: 0.05 }]) },
      { label: '婉拒', hint: '沒有變化', branches: one('老闆客氣地婉拒了。張經理收起樣品,說下次有新貨會再來。', []) },
    ],
  },
  {
    id: 'fire-inspect', slot: 'morning', icon: '🧯', tag: '突發檢查', title: '消防局臨檢', cast: ['boss', 'wei'], weight: 2, when: (c) => c.day >= 2,
    body: ['上午十點,兩位消防局的人員走進店裡,說要做例行安全檢查。', '大偉皺著眉小聲說:「老闆,走道有幾個地方堆了紙箱,電線也有點亂……」', '檢查員正在門口翻看他的清單。'],
    choices: [
      { label: '花錢請廠商立刻整改', hint: '現金 -1,500;聲望 +0.1', branches: one('廠商一小時內把電線整理好,紙箱也搬走了。檢查員點點頭,在表上打了勾。', [{ cash: -1500 }, { rep: 0.1 }]) },
      { label: '員工自己快速整理', hint: '現金 -300;可能被罰', branches: [
        { p: 0.6, outcome: '全店動員,十分鐘內把走道清空。檢查員看了一圈,勉強過關。', effects: [{ cash: -300 }] },
        { p: 1, outcome: '檢查員發現配電箱前還堆著東西,開了一張罰單,還要求下週複查。', effects: [{ cash: -2500 }, { rep: -0.1 }, { chain: { id: 'fire-recheck', after: 3 } }] },
      ] },
    ],
  },
  {
    id: 'fire-recheck', slot: 'morning', icon: '🧯', tag: '後續', title: '消防局回來複查', cast: ['boss', 'wei'], weight: 1000, chainOnly: true,
    body: ['三天前被開罰單的事,老闆一直記在心上。今天消防員準時出現在門口。', '大偉用力拍了拍胸口:「老闆,我昨晚把整間店的線路都走過一遍了。」'],
    choices: [
      { label: '帶檢查員逐項說明', hint: '聲望 +0.1', branches: one('這次一切合規。檢查員臨走前說:「看得出你們有認真改善。」', [{ rep: 0.1 }, { morale: { who: 'wei', delta: 0.12 } }]) },
    ],
  },
  {
    id: 'wen-leave', slot: 'morning', icon: '🏥', tag: '員工狀況', title: '小雯的家裡有事', cast: ['wen', 'boss'], weight: 2, when: (c) => c.crew >= 3,
    body: ['小雯一早就紅著眼眶來找老闆:「老闆,我媽媽昨晚住院了,我想請幾天假……可是今天人手本來就不夠,對不起。」', '店裡的人都看著這裡。'],
    choices: [
      { label: '准假三天,安心去照顧', hint: '小雯請假 3 天;全員士氣 +8%', branches: one('小雯鞠了好幾次躬。同事們互相支援,接下來幾天雖然辛苦,但大家都沒有抱怨。', [{ leave: { who: 'wen', days: 3 } }, { morale: { who: 'all', delta: 0.08 } }]) },
      { label: '請她撐過這個週末', hint: '小雯士氣 -25%;全員士氣 -5%', branches: one('小雯點點頭,眼眶更紅了。整天她都強顏歡笑,但動作明顯變慢,同事們也看在眼裡。', [{ morale: { who: 'wen', delta: -0.25 } }, { morale: { who: 'all', delta: -0.05 } }]) },
    ],
  },
  {
    id: 'kai-raise', slot: 'morning', icon: '💰', tag: '員工狀況', title: '阿凱想加薪', cast: ['kai', 'boss'], weight: 2, when: (c) => c.day >= 3,
    body: ['阿凱趁開店前攔住老闆,搔著頭說:「老闆,我在這邊快五年了,這陣子搬貨跑得比誰都多……能不能談談薪水?」'],
    choices: [
      { label: '發一筆獎金並加薪', hint: '現金 -2,000;阿凱速度 +4、士氣 +25%', branches: one('阿凱愣了一下,隨即大力點頭:「謝謝老闆!我會更拚的!」之後整天跑得特別快。', [{ cash: -2000 }, { trait: { who: 'kai', stat: 0, delta: 4 } }, { morale: { who: 'kai', delta: 0.25 } }]) },
      { label: '口頭肯定,下個月再談', hint: '阿凱士氣 +5%', branches: [
        { p: 0.7, outcome: '阿凱想了想,說:「好吧,我相信老闆。」', effects: [{ morale: { who: 'kai', delta: 0.05 } }] },
        { p: 1, outcome: '阿凱表面上點頭,但整天都悶悶不樂。', effects: [{ morale: { who: 'kai', delta: -0.12 } }, { flag: 'kai-upset' }] },
      ] },
      { label: '直接拒絕', hint: '阿凱士氣 -30%;可能引發後續', branches: one('阿凱抿著嘴說了聲「好」,轉身去搬貨。那天的腳步聲特別重。', [{ morale: { who: 'kai', delta: -0.3 } }, { flag: 'kai-upset' }, { chain: { id: 'kai-quit', after: 3 } }]) },
    ],
  },
  {
    id: 'kai-quit', slot: 'morning', icon: '📄', tag: '後續', title: '阿凱遞出辭呈', cast: ['kai', 'boss', 'mei'], weight: 1000, chainOnly: true,
    body: ['阿凱把一張摺得整整齊齊的紙放在老闆桌上。「老闆,我找到別家的工作了……謝謝你這些年的照顧。」', '小美在門邊欲言又止。她知道,阿凱是為了加薪的事。'],
    choices: [
      { label: '慰留,補發獎金並加薪', hint: '現金 -3,000;阿凱留下,速度 +3、士氣 +30%', branches: one('老闆誠懇地道歉,阿凱沉默很久,最後把辭呈撕了:「下次有事先講,不要拖。」', [{ cash: -3000 }, { trait: { who: 'kai', stat: 0, delta: 3 } }, { morale: { who: 'kai', delta: 0.4 } }]) },
      { label: '尊重他的決定', hint: '阿凱離開 10 天;全員士氣 -10%', branches: one('老闆和阿凱握了手。接下來幾天,少了他的店裡顯得有點冷清,同事們都有些失落。', [{ leave: { who: 'kai', days: 10 } }, { morale: { who: 'all', delta: -0.1 } }]) },
    ],
  },
  {
    id: 'ex-maintain', slot: 'morning', icon: '🪙', tag: '設備', title: '兌幣機該保養了', cast: ['boss', 'wei'], weight: 2,
    body: ['大偉拿著工具箱蹲在兌幣機旁:「老闆,這兩台的驗鈔模組已經有點髒了,最近才會一直卡鈔。」', '廠商說可以今天來全面保養,但要收費。'],
    choices: [
      { label: '全面保養', hint: '現金 -1,800;兌幣機卡鈔機率大減(6 天)', branches: one('廠商拆開驗鈔模組,清出一堆灰塵和不明紙屑。保養完的兌幣機吞鈔順暢多了。', [{ cash: -1800 }, { mod: { label: '兌幣機保養', days: 6, jam: 0.25 } }]) },
      { label: '只做簡單清潔', hint: '現金 -300;卡鈔機率小減(3 天)', branches: one('大偉拿棉花棒清了一遍,勉強有點改善。', [{ cash: -300 }, { mod: { label: '兌幣機清潔', days: 3, jam: 0.7 } }]) },
      { label: '先不處理', hint: '沒有變化', branches: one('老闆覺得再撐一下沒問題。', []) },
    ],
  },
  {
    id: 'press', slot: 'morning', icon: '📰', tag: '媒體', title: '地方報紙想採訪', cast: ['boss', 'ting'], weight: 2, when: (c) => c.rep >= 2.6,
    body: ['一位地方記者來電:「聽說你們店最近很紅,想做一篇『夾娃娃店的日常』專題。」', '雅婷在旁邊笑著比了個讚,老闆則有點緊張。'],
    choices: [
      { label: '大方接受採訪', hint: '聲望 +0.15;客流 +15%(3 天);全員士氣 +6%', branches: [
        { p: 0.75, outcome: '記者拍了很多員工工作的照片,報導標題是「小店裡的大人情味」。隔天就有客人拿著報紙來店裡。', effects: [{ rep: 0.15 }, { mod: { label: '地方報導', days: 3, arrival: 1.15 } }, { morale: { who: 'all', delta: 0.06 } }] },
        { p: 1, outcome: '記者剛好拍到一台故障的機台,報導裡有一小段提到「服務還有進步空間」。', effects: [{ rep: 0.05 }] },
      ] },
      { label: '婉拒,專心經營', hint: '沒有變化', branches: one('老闆說想先把店顧好。記者笑著說隨時歡迎再聯絡。', []) },
    ],
  },
  {
    id: 'price-up', slot: 'morning', icon: '📈', tag: '進貨', title: '供應商要漲價了', cast: ['boss', 'shan'], weight: 2, when: (c) => c.day >= 4,
    body: ['供應商打來通知:下個月起,所有娃娃進貨價平均漲一成。', '佩珊翻著倉庫的帳本:「老闆,如果現在先囤一批,成本能鎖在舊價。」'],
    choices: [
      { label: '先囤 100 隻', hint: '現金 -2,600;倉庫 +100 隻', branches: one('倉庫又多了幾排紙箱。佩珊把進貨日期一箱一箱貼好標籤,說這樣先進先出。', [{ cash: -2600 }, { stock: 100 }]) },
      { label: '先觀望', hint: '沒有變化', branches: one('老闆決定等看看。', []) },
    ],
  },
  {
    id: 'landlord', slot: 'morning', icon: '🏢', tag: '房租', title: '房東想調漲租金', cast: ['boss'], weight: 2, when: (c) => c.day >= 5,
    body: ['房東親自來到店裡,笑咪咪地說:「老闆,你們生意這麼好,租約要續了,我們來聊聊新的租金吧。」'],
    choices: [
      { label: '好好談判', hint: '一半機率維持原價,否則漲 NT$300/天(7 天)', branches: [
        { p: 0.5, outcome: '老闆拿出最近的營收與整潔度記錄,房東點點頭:「好吧,這次維持原價。」', effects: [{ rep: 0.02 }] },
        { p: 1, outcome: '談了一小時,最後折衷:每天多收 300 元。', effects: [{ mod: { label: '租金調漲', days: 7, rent: 300 } }] },
      ] },
      { label: '直接接受', hint: '租金 +NT$300/天(7 天)', branches: one('老闆簽了字。房東滿意地離開。', [{ mod: { label: '租金調漲', days: 7, rent: 300 } }]) },
    ],
  },
  {
    id: 'typhoon', slot: 'morning', icon: '🌀', tag: '天氣', title: '颱風外圍環流來了', cast: ['boss', 'mei'], weight: 1, when: (c) => c.day >= 3,
    body: ['氣象預報說午後有強降雨。小美看著窗外的烏雲:「老闆,下雨天客人進門會帶水,地板會很滑。」'],
    choices: [
      { label: '照常營業,多鋪防滑墊', hint: '現金 -400;客流 -30%、地上更容易有水漬(1 天)', branches: one('門口鋪了三條防滑墊。雨一直下,店裡人少了些,但還算順利。', [{ cash: -400 }, { mod: { label: '下雨天', days: 1, arrival: 0.7, spill: 1.6 } }]) },
      { label: '發熱茶與雨傘套', hint: '現金 -900;客流 -10%、客人心情 +(1 天);聲望 +0.05', branches: one('小美在門口擺了一壺熱茶。進門的客人拿著紙杯,臉上都帶著笑。', [{ cash: -900 }, { mod: { label: '暖心熱茶', days: 1, arrival: 0.9, mood: 0.12 } }, { rep: 0.05 }]) },
    ],
  },
  // ======================= 中午 =======================
  {
    id: 'birthday', slot: 'midday', icon: '🎂', tag: '大客群', title: '國中生包場慶生', cast: ['jie', 'boss'], weight: 3,
    body: ['下午一點,二十幾個國中生穿著制服湧進店裡。小傑大聲宣布:「今天我生日,大家都來夾!」', '店裡一下子熱鬧得像菜市場。'],
    choices: [
      { label: '歡迎,還送小禮物', hint: '現金 -600;客流 +40%、水漬機率 +60%(1 天);聲望 +0.1', branches: one('老闆端出一盤小餅乾。孩子們唱起了生日快樂歌,連路過的客人都被吸引進來。', [{ cash: -600 }, { mod: { label: '慶生客群', days: 1, arrival: 1.4, spill: 1.6 } }, { rep: 0.1 }]) },
      { label: '請他們分批進場', hint: '客流 +10%(1 天);聲望 -0.03', branches: one('店員請孩子們排隊分批進場。有人嘟著嘴,但店裡的秩序維持得不錯。', [{ mod: { label: '分批進場', days: 1, arrival: 1.1 } }, { rep: -0.03 }]) },
    ],
  },
  {
    id: 'ama-wish', slot: 'midday', icon: '🧸', tag: '常客故事', title: '阿嬤想要那隻熊', cast: ['r-ama', 'wen'], weight: 3,
    body: ['阿嬤牽著孫子站在 17 號機前很久了。孫子指著玻璃裡最大的那隻熊,眼睛閃閃發亮。', '阿嬤試了好幾次,都差一點點。她回頭小聲問小雯:「小姑娘,能不能……請你們幫個忙?」'],
    choices: [
      { label: '請小雯幫忙調整位置', hint: '聲望 +0.1;阿嬤會記得這份人情', branches: one('小雯笑著把熊熊挪到出口邊,阿嬤一次就夾中了。孫子抱著熊跳起來,阿嬤的眼眶都紅了。', [{ rep: 0.1 }, { morale: { who: 'wen', delta: 0.1 } }, { chain: { id: 'ama-gift', after: 2 } }]) },
      { label: '照規矩,讓她自己夾', hint: '沒有變化', branches: one('阿嬤又試了三次,最後孫子說:「阿嬤沒關係,下次再來。」祖孫倆牽著手離開。', []) },
    ],
  },
  {
    id: 'ama-gift', slot: 'morning', icon: '🍱', tag: '後續', title: '阿嬤帶來的點心', cast: ['r-ama', 'wen', 'mei'], weight: 1000, chainOnly: true,
    body: ['一早,阿嬤提著一個保溫袋出現在店門口。', '「上次的事,我一直放在心上。這是我自己做的鳳梨酥,請大家吃。」袋子一打開,整間店都是香味。'],
    choices: [
      { label: '全員一起享用,向阿嬤道謝', hint: '全員士氣 +12%;聲望 +0.08', branches: one('大家圍在櫃台邊吃鳳梨酥。阿嬤笑咪咪地說:「你們好好做,我每個禮拜都來。」', [{ morale: { who: 'all', delta: 0.12 } }, { rep: 0.08 }]) },
    ],
  },
  {
    id: 'ming-complain', slot: 'midday', icon: '😤', tag: '客訴', title: '阿明說爪力有問題', cast: ['r-ming', 'ting'], weight: 3,
    body: ['陳志明西裝都沒脫,拍了一下機台玻璃:「這台一定有問題!我連續五次都在最後一刻鬆掉!」', '周圍的客人都轉頭看過來。阿明面子很重,聲音卻越來越大。'],
    choices: [
      { label: '請雅婷好言說明並招待 3 枚幣', hint: '現金 -60;聲望 +0.05', branches: [
        { p: (c) => 0.6 + c.crew * 0.05, outcome: '雅婷笑著把阿明請到一旁,講解爪力每次都會浮動。阿明聽完消了氣,還跟她聊起工作壓力。', effects: [{ cash: -60 }, { rep: 0.05 }] },
        { p: 1, outcome: '阿明還是不太滿意,但至少沒再大聲嚷嚷。', effects: [{ cash: -60 }] },
      ] },
      { label: '當場公開檢查機台設定', hint: '聲望 +0.1,但爪力 +5%(2 天)', branches: one('老闆打開機台,大方地讓客人看設定。阿明愣住了,周圍的客人還拍手。「這家店坦蕩!」有人說。', [{ rep: 0.1 }, { mod: { label: '公開透明', days: 2, strength: 0.05 } }]) },
      { label: '不予理會', hint: '聲望 -0.1;客流 -10%(2 天)', branches: one('阿明氣呼呼地走了。隔天網路上多了一則「爪力黑箱」的留言。', [{ rep: -0.1 }, { mod: { label: '負面留言', days: 2, arrival: 0.9 } }]) },
    ],
  },
  {
    id: 'streamer', slot: 'midday', icon: '📱', tag: '常客故事', title: '阿翔想在店裡直播', cast: ['r-xiang', 'boss'], weight: 2,
    body: ['張阿翔舉著手機在門口比手畫腳:「老闆,我有三千個粉絲,讓我在店裡開直播,保證幫你宣傳!」', '他的手機鏡頭已經在拍老闆的臉了。'],
    choices: [
      { label: '免費場地,再送他 20 枚幣', hint: '現金 -400;有機率爆紅(客流 +50%,2 天)', branches: [
        { p: 0.55, outcome: '直播間人數一路飆升。阿翔夾到稀有款時尖叫的剪輯被轉傳,隔天店門口排了一小群人。', effects: [{ cash: -400 }, { rep: 0.15 }, { mod: { label: '直播爆紅', days: 2, arrival: 1.5 } }] },
        { p: 1, outcome: '阿翔整場都夾不到,最後對著鏡頭哀號。搞笑歸搞笑,效果普普。', effects: [{ cash: -400 }, { rep: 0.03 }] },
      ] },
      { label: '收場地贊助費', hint: '現金 +1,200;客流 +10%(1 天)', branches: one('阿翔嘟囔著掏出錢包,但還是開了直播。店裡因此多了幾位好奇的粉絲。', [{ cash: 1200 }, { mod: { label: '直播路人', days: 1, arrival: 1.1 } }]) },
      { label: '婉拒', hint: '沒有變化', branches: one('阿翔失望地收起手機:「好吧,那我只玩不拍。」', []) },
    ],
  },
  {
    id: 'lost-kid', slot: 'midday', icon: '🧒', tag: '突發', title: '有個小朋友找不到媽媽', cast: ['r-xuan', 'wen'], weight: 2,
    body: ['小萱抱著一隻兔兔娃娃站在機台中間,眼淚吧嗒吧嗒掉:「爸爸……爸爸不見了……」', '小雯立刻蹲下身。店裡的人都停下手邊的事,望向這裡。'],
    choices: [
      { label: '全員停下手邊工作協助尋找', hint: '全員士氣 +8%;聲望 +0.12', branches: one('不到五分鐘,小萱的爸爸從廁所方向衝出來,緊緊抱住她。客人們自發鼓掌。', [{ morale: { who: 'all', delta: 0.08 } }, { rep: 0.12 }]) },
      { label: '廣播並請小雯陪她等', hint: '聲望 +0.05', branches: one('廣播響起,小萱的爸爸很快就出現了。他連聲道謝。', [{ rep: 0.05 }]) },
    ],
  },
  {
    id: 'mystery', slot: 'midday', icon: '🕵️', tag: '評鑑', title: '神祕客悄悄進店', cast: ['boss'], weight: 2, when: (c) => c.rep >= 2.4,
    body: ['下午兩點,一位拿著手機的陌生人走進店裡。他沒有玩,只是慢慢地從第一排走到最後一排,偶爾蹲下來看看機台的玻璃。', '有人說,這是某個娃娃機評鑑社群的神祕客。'],
    choices: [
      { label: '照常營業,不特別招呼', hint: '結果取決於店裡的整潔與機台狀況', branches: [
        { p: (c) => Math.max(0.1, Math.min(0.9, 0.85 - c.dirt * 1.2 - c.faults * 0.08)), outcome: '神祕客拍了幾張乾淨的走道與明亮的機台。幾天後,社群上出現「推薦店家」的標籤。', effects: [{ rep: 0.18 }, { mod: { label: '評鑑推薦', days: 3, arrival: 1.2 } }] },
        { p: 1, outcome: '神祕客拍下了髒髒的玻璃和一台壞掉的機台。社群上多了一則「還需加強」的評論。', effects: [{ rep: -0.12 }] },
      ] },
    ],
  },
  // ======================= 傍晚 =======================
  {
    id: 'snack', slot: 'evening', icon: '🍰', tag: '員工關懷', title: '老闆請大家吃點心', cast: ['boss', 'shan', 'yu'], weight: 2,
    body: ['晚上六點,老闆提著一袋剛出爐的雞蛋糕走進休息室。', '小宇眼睛一亮:「老闆!我今天一整個下午都在搬貨,餓死了!」佩珊笑著說:「這個月沒白幹。」'],
    choices: [
      { label: '輪流休息,大家一起吃', hint: '現金 -300;全員士氣 +10%', branches: one('員工們輪流到休息室吃了一塊,又回到崗位上。氣氛輕鬆許多。', [{ cash: -300 }, { morale: { who: 'all', delta: 0.1 } }]) },
      { label: '放在櫃台,忙完再吃', hint: '現金 -300;士氣 +4%', branches: one('雞蛋糕放到涼了才被吃掉,但大家還是說了聲謝謝。', [{ cash: -300 }, { morale: { who: 'all', delta: 0.04 } }]) },
    ],
  },
  {
    id: 'hao-idea', slot: 'evening', icon: '🔧', tag: '員工提案', title: '志豪想大修一輪機台', cast: ['hao', 'boss'], weight: 2,
    body: ['志豪推了推眼鏡:「老闆,我研究過故障記錄,大部分問題都出在同一個零件。如果我趁夜班把它們全換掉,以後會少很多麻煩。」', '他眼睛裡閃著工程師特有的光。'],
    choices: [
      { label: '批准,並出零件費', hint: '現金 -2,500;機台故障減少(5 天);志豪技術 +3', branches: one('接下來幾個晚上,志豪一台一台打開機台換零件。他說這比打電動還有趣。', [{ cash: -2500 }, { mod: { label: '全面維護', days: 5, fault: 0.6 } }, { trait: { who: 'hao', stat: 2, delta: 3 } }]) },
      { label: '先暫緩', hint: '志豪士氣 -8%', branches: one('志豪點點頭,收起筆記本,但臉上明顯有點失落。', [{ morale: { who: 'hao', delta: -0.08 } }]) },
    ],
  },
  {
    id: 'contest', slot: 'evening', icon: '🏆', tag: '活動', title: '老手們想辦夾娃娃比賽', cast: ['r-wang', 'r-ming'], weight: 2, when: (c) => c.rep >= 2.5,
    body: ['王大哥跟阿明吵得面紅耳赤,誰都說自己才是店裡最強的。', '最後王大哥拍桌:「老闆,辦一場比賽,誰輸誰請全場喝飲料!」周圍的客人都起鬨。'],
    choices: [
      { label: '辦!獎品我來出', hint: '現金 -1,200;客流 +35%(2 天);聲望 +0.1', branches: one('兩個人在機台前較勁,圍觀的人越來越多。最後王大哥以一隻之差險勝,全場爆出歡呼。', [{ cash: -1200 }, { mod: { label: '夾娃娃比賽', days: 2, arrival: 1.35 } }, { rep: 0.1 }]) },
      { label: '下次再說', hint: '沒有變化', branches: one('老闆笑著打圓場。兩位老手各自哼了一聲,回去夾自己的。', []) },
    ],
  },
  {
    id: 'drunk', slot: 'evening', icon: '🍺', tag: '突發', title: '醉客在店裡亂晃', cast: ['ting', 'boss'], weight: 2,
    body: ['晚上九點,一位滿身酒味的男客人一直拍機台玻璃,還大聲嚷嚷這家店騙人。', '其他客人紛紛往旁邊退。雅婷看了老闆一眼,輕聲問:「要我過去嗎?」'],
    choices: [
      { label: '請雅婷柔性勸導', hint: '成功率取決於店員人數與氣氛', branches: [
        { p: (c) => 0.55 + c.crew * 0.07, outcome: '雅婷笑著遞上一杯水,陪他聊了幾句,他居然自己乖乖坐到休息區去了。', effects: [{ rep: 0.05 }, { morale: { who: 'ting', delta: 0.1 } }] },
        { p: 1, outcome: '客人越講越激動,打翻了桌上的飲料。雖然最後平息了,但地上一片狼藉。', effects: [{ mod: { label: '醉客風波', days: 1, spill: 2.2 } }, { rep: -0.05 }] },
      ] },
      { label: '直接報警', hint: '聲望 -0.03;客流 -10%(1 天)', branches: one('警察很快到場把人帶走。客人們鬆了口氣,但整個晚上氣氛都有點緊繃。', [{ rep: -0.03 }, { mod: { label: '警方到場', days: 1, arrival: 0.9 } }]) },
    ],
  },
];

export const storyById = (id: string) => STORIES.find((s) => s.id === id);
