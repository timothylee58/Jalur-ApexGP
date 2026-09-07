import type { Dictionary } from "../types";

// Simplified Chinese (matches the register used in Malaysia/Singapore
// Chinese-language media). AI-translated (not reviewed by a professional
// or native speaker) — matches this app's honesty standard: flag this
// rather than present it as authoritative. F1-specific terms (DRS, ERS,
// undercut/overcut) keep their English form where that's how real
// Chinese-language motorsport media actually writes them.
export const zh: Dictionary = {
  nav: {
    predict: "预测",
    picks: "竞猜",
    circuit: "赛道",
    accuracy: "准确度",
    drivers: "车手",
    teams: "车队",
    fan: "车迷",
    news: "新闻",
    telemetry: "遥测",
    drive: "驾驶",
    reveal: "发布",
    lore: "历史",
    guide: "指南",
    seats: "座位",
    calendar: "赛历",
  },
  guide: {
    kicker: "F1 新手？",
    title: "规则，简单明了",
    intro:
      "六项本赛季规则以浅显易懂的方式讲解，之后附上小测验检验你的理解。这里的每项事实都经过真实资料来源核实——包括 F1 2026 赛季的规则变动，而非上一个十年的旧规则。",
    quizLabel: "新手测验",
    disclaimer:
      "Jalur APEXGP 是一个独立的车迷项目——与一级方程式（F1）、国际汽车联盟（FIA）或雪邦国际赛道均无关联，亦未获其认可或官方合作。",
    cards: [
      {
        id: "overtake-mode",
        title: "超车模式（DRS 的替代方案）",
        body: "F1 在 2025 赛季结束后淘汰了使用 14 年的减阻系统（DRS）——一个单一的后翼襟翼装置。从 2026 年起，超车辅助改由一套全主动式空气动力系统提供，可同时调整前后翼。公平规则与 DRS 相同：车手必须在赛道侦测点与前车相距一秒以内，才能在随后的区域启用该功能。",
      },
      {
        id: "tyre-compounds",
        title: "轮胎配方",
        body: "倍耐力（Pirelli）每个赛季提供五种干地配方，从 C1（最硬）到 C5（最软），并为每站比赛周末从中选出三种——分别标示为硬胎（白边）、中性胎（黄边）与软胎（红边），仅限该场比赛使用。某赛道的\"软胎\"实际配方可能比另一赛道的\"软胎\"更硬；这些标签只是相对于当站所选配方而言，并非固定不变的配方。",
      },
      {
        id: "flags",
        title: "旗语",
        body: "黄旗：减速，禁止超车——前方有危险。红旗：比赛环节完全中止。蓝旗：提示落后一圈的赛车须让速度更快的赛车通过。方格旗：该环节结束。",
      },
      {
        id: "pit-strategy",
        title: "Undercut（提前进站）与 Overcut（延后进站）",
        body: "提前进站（undercut）是指比你追赶的对手更早进站——新胎在头几圈速度更快，因此对手最终进站后你便可能反超。延后进站（overcut）则相反：在对手进站时继续留在赛道上跑旧胎，赌的是清洁空气带来的优势能胜过对手较慢的出站圈。",
      },
      {
        id: "safety-car",
        title: "安全车",
        body: "在发生事故后中和比赛——车队在安全车后方以降低的速度集结成队，因此在此期间进站所耗费的时间远少于全速比赛时进站。若车队能在恰当时机遇上安全车期，往往能几乎不费代价地获得位置提升。",
      },
      {
        id: "ers",
        title: "ERS（能量回收系统）",
        body: "F1 动力单元的混合动力部分——从刹车与排气废热中回收的电能，储存于电池中，并可依需要释放以提供额外动力。车手与工程师需在一整圈中管理该释放多少能量，以备后续防守或进攻之用。",
      },
    ],
    quiz: [
      {
        id: "points-win",
        question: "赢得一场分站赛能获得多少积分？",
        options: ["10", "20", "25", "30"],
        correctIndex: 2,
        explanation: "冠军获 25 分，依名次递减至第十名获 1 分（18-15-12-10-8-6-4-2-1）。",
      },
      {
        id: "fastest-lap-point",
        question: "比赛最快圈速是否仍有额外加分？",
        options: ["有，前提是名列前十", "没有——已于 2024 赛季后废除", "有，任何车手皆可获得", "仅限冲刺赛（Sprint）"],
        correctIndex: 1,
        explanation: "最快圈速加分制度自 2025 赛季起已被取消——如今唯一的得分依据就是完赛名次。",
      },
      {
        id: "drs-replacement",
        question: "2026 赛季由什么取代了 DRS？",
        options: [
          "没有变化——DRS 维持不变",
          "超车模式，属于新的主动空气动力系统",
          "推进超车（push-to-pass）按钮",
          "仅限冲刺赛使用的 DRS",
        ],
        correctIndex: 1,
        explanation: "F1 2026 规则在沿用 14 个赛季后淘汰了单一后翼襟翼式 DRS，改以可同时调整前后翼的主动空气动力系统取代。",
      },
      {
        id: "mandatory-compounds",
        question: "在干地比赛中，车手必须使用几种不同的轮胎配方？",
        options: ["1 种", "2 种", "3 种", "没有规定——可自由选择"],
        correctIndex: 1,
        explanation: "干地比赛中至少须使用两种不同的干地配方，这也保证了至少一次进站。",
      },
      {
        id: "yellow-flag",
        question: "黄旗代表什么意思？",
        options: ["比赛结束", "让速度更快的赛车通过", "减速，禁止超车——前方有危险", "立即进站"],
        correctIndex: 2,
        explanation: "黄旗是警示信号：须减速且禁止超车，直到驶过危险区域为止。",
      },
      {
        id: "safety-car-effect",
        question: "安全车对车队（赛道上所有赛车）有什么影响？",
        options: ["直接结束该环节", "使全体赛车以降低速度集结在其后方", "增加一次强制进站", "只会让领跑者减速"],
        correctIndex: 1,
        explanation: "它会中和比赛——所有赛车会紧跟在其后方集结，这也是为何此时进站所耗费的时间会大幅减少。",
      },
      {
        id: "softest-compound",
        question: "哪一种轮胎配方最软？",
        options: ["C1", "C3", "C5", "五种配方软硬度相同"],
        correctIndex: 2,
        explanation: "C1 是五种配方中最硬的，C5 则是最软的。",
      },
      {
        id: "undercut-def",
        question: "什么是「undercut（提前进站）」？",
        options: ["比对手在赛道上多跑一段时间", "在对手之前进站，换上更新更快的轮胎", "一种路缘石", "在安全车期间超车"],
        correctIndex: 1,
        explanation: "先行进站，新胎带来的额外速度优势往往足以让你在对手最终进站后反超对方。",
      },
      {
        id: "sprint-points",
        question: "F1 冲刺赛（Sprint）中有多少名完赛车手可获得积分？",
        options: ["前 3 名", "前 8 名", "前 10 名", "所有完赛车手"],
        correctIndex: 1,
        explanation: "冲刺赛为前 8 名颁发积分，依序为 8-7-6-5-4-3-2-1——积分范围比正赛的前 10 名更短。",
      },
      {
        id: "sepang-length",
        question: "雪邦国际赛道一圈的长度是多少？",
        options: ["3.4 公里", "4.8 公里", "5.543 公里", "6.2 公里"],
        correctIndex: 2,
        explanation: "5.543 公里，15 个弯道——本网站所有赛道地图与数据都以此数字为准。",
      },
    ],
  },
  quizUi: {
    questionOf: "第 {current} / {total} 题",
    score: "得分",
    correct: "答对了。",
    notQuite: "不太对。",
    correctSuffix: "——正确答案",
    yourAnswerSuffix: "——你的答案",
    nextQuestion: "下一题",
    seeResults: "查看结果",
    quizComplete: "测验完成",
    cleanSweep: "全对——你对现行规则了如指掌。",
    tryAgain: "再接再厉——每题的解析在你作答后会持续显示。",
    playAgain: "再玩一次",
  },
};
