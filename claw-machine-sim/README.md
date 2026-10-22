# 夾娃娃樂園 Claw Club(原型 P0 + P1)

網頁版 3D 夾娃娃機經營模擬遊戲。目前完成「一台寫實機台 + 物理娃娃 + 手動夾取」,桌機與手機皆可操作。

## 執行

```bash
cd claw-machine-sim
npm install
npm run dev      # 開發伺服器(區網可用手機連線測試)
npm run build    # 型別檢查 + 打包到 dist/
```

## 操作

| 裝置 | 移動 | 放爪 |
|---|---|---|
| 桌機 | 方向鍵 / WASD,或拖曳畫面搖桿 | 空白鍵 / 「放爪」鈕 |
| 手機 | 左下虛擬搖桿 | 右下「放爪」鈕 |

右上角:🎥 切換視角(正面 / 側面 / 俯視)、⚙️ 機台設定(爪力、補貨、加幣)、🔊 音效。

## 架構

```
src/
├─ config.ts       常數:機台尺寸、爪子速度、稀有度
├─ physics.ts      Rapier 剛體世界:地板/出口/玻璃、娃娃生成、得獎偵測
├─ claw.ts         爪子:物理剛體 + 狀態機 + 爪力模型
├─ plush.ts        程序化毛絨娃娃模型與材質(6 種 × 3 稀有度)
├─ cabinet.ts      機台 3D 模型:外殼、玻璃、龍門架、操作台、LED
├─ environment.ts  店內場景:地板、牆面、霓虹、鄰近機台
├─ render.ts       渲染管線(PBR、Bloom、MSAA)與鏡頭
├─ input.ts        鍵盤 + 虛擬搖桿
├─ audio.ts        WebAudio 合成音效
├─ textures.ts     全部貼圖以 canvas 程序生成(無外部素材)
└─ main.ts         遊戲主迴圈、UI 綁定
```

分三層,方便之後接經營系統:**模擬層**(physics / claw)、**表現層**(cabinet / plush / render)、**介面層**(index.html / input)。

### 爪子狀態機

`idle → play → descend → close → lift → travel → release → return → idle`

### 爪力模型(經營系統的核心旋鈕)

真實的娃娃機靠「爪力時強時弱」控制出貨率。這裡用兩段式:

1. 夾取當下由真實物理決定能不能包住娃娃(爪子是運動學剛體)。
2. 起吊時依 `strength` 擲骰:失敗則在 0.3~2.7 秒內鬆爪,成功則以彈簧阻尼輔助提起。

`strength`(0.15~0.95)之後可由「機台設定」、營運成本、顧客滿意度等系統連動。

## 路線圖

- [x] P0 物理抓取手感
- [x] P1 寫實視覺基調
- [ ] P2 經營骨架:顧客 AI、營業日、收支結算
- [ ] P3 多機台、進貨、升級、隨機事件
- [ ] P4 主題店、成就、存檔
