import type { Dictionary } from "../types";

// Bahasa Malaysia. AI-translated (not reviewed by a professional or native
// speaker) — matches this app's honesty standard: flag this rather than
// present it as authoritative. F1-specific terms (DRS, ERS, pit stop,
// undercut/overcut) are kept in English where that's how real Malaysian
// motorsport media actually writes them — over-translating those would
// read as unnatural, not more accurate.
export const ms: Dictionary = {
  nav: {
    predict: "Ramalan",
    picks: "Tekaan",
    circuit: "Litar",
    accuracy: "Ketepatan",
    drivers: "Pemandu",
    teams: "Pasukan",
    fan: "Peminat",
    news: "Berita",
    telemetry: "Telemetri",
    drive: "Pandu",
    reveal: "Pendedahan",
    lore: "Kisah",
    guide: "Panduan",
    seats: "Kerusi",
    calendar: "Kalendar",
  },
  guide: {
    kicker: "Baru dalam F1?",
    title: "Peraturan, secara ringkas",
    intro:
      "Enam peraturan musim semasa diterangkan dalam bahasa mudah, diikuti kuiz untuk menguji kefahaman anda. Setiap fakta di sini disemak berdasarkan sumber sebenar — termasuk perubahan peraturan F1 2026, bukan peraturan dekad lepas.",
    quizLabel: "Kuiz Pemula",
    disclaimer:
      "Jalur APEXGP ialah projek peminat yang bebas — tiada kaitan dengan, tidak disokong oleh, dan bukan rakan kongsi rasmi Formula 1, FIA, atau Litar Antarabangsa Sepang.",
    cards: [
      {
        id: "overtake-mode",
        title: "Mod Overtake (pengganti DRS)",
        body: "F1 memansuhkan sistem Drag Reduction System (DRS) yang berusia 14 tahun — satu kepak sayap belakang tunggal — selepas musim 2025. Bermula 2026, bantuan memotong (overtake) datang daripada sistem aerodinamik aktif sepenuhnya yang melaraskan kedua-dua sayap depan dan belakang. Peraturan keadilan kekal sama seperti DRS: pemandu perlu berada dalam jarak satu saat daripada kereta di hadapan pada titik pengesanan litar untuk membuka mod ini di zon berikutnya.",
      },
      {
        id: "tyre-compounds",
        title: "Kompaun tayar",
        body: 'Pirelli membawa lima kompaun tayar kering setiap musim, C1 (paling keras) hingga C5 (paling lembut), dan memilih tiga untuk setiap hujung minggu perlumbaan — dilabel Keras (dinding sisi putih), Sederhana (kuning), dan Lembut (merah) untuk perlumbaan itu sahaja. "Lembut" di satu litar boleh jadi kompaun yang lebih keras berbanding "Lembut" di litar lain; label ini relatif kepada pilihan hujung minggu tersebut, bukan resipi getah tetap.',
      },
      {
        id: "flags",
        title: "Bendera",
        body: "Kuning: perlahankan, dilarang memotong — bahaya di hadapan. Merah: sesi dihentikan sepenuhnya. Biru: kereta yang tertinggal satu pusingan diarah membenarkan kereta lebih pantas melepasi. Berpetak: sesi telah tamat.",
      },
      {
        id: "pit-strategy",
        title: "Undercut lwn overcut",
        body: "Undercut bermaksud masuk pit lebih awal daripada kereta yang anda kejar — tayar baharu lebih pantas untuk beberapa pusingan, jadi anda boleh mendahului sebaik sahaja mereka akhirnya masuk pit. Overcut pula sebaliknya: kekal di litar dengan tayar lama semasa pesaing masuk pit, bertaruh bahawa udara bersih mengatasi pusingan keluar mereka yang lebih perlahan.",
      },
      {
        id: "safety-car",
        title: "Kereta keselamatan",
        body: "Meneutralkan perlumbaan selepas insiden — barisan kereta berkumpul di belakangnya pada kelajuan rendah, jadi masuk pit semasa ini kos masa jauh lebih sedikit berbanding masuk pit pada kelajuan penuh. Pasukan yang memasuki pit pada waktu yang tepat semasa kereta keselamatan sering mendapat kedudukan hampir percuma.",
      },
      {
        id: "ers",
        title: "ERS (Sistem Pemulihan Tenaga)",
        body: "Bahagian hibrid enjin kuasa F1 — tenaga elektrik yang dipulihkan daripada brek dan haba ekzos, disimpan dalam bateri, dan digunakan untuk kuasa tambahan mengikut keperluan. Pemandu dan jurutera menguruskan berapa banyak tenaga untuk disimpan sepanjang satu pusingan bagi pergerakan defensif atau serangan kemudian.",
      },
    ],
    quiz: [
      {
        id: "points-win",
        question: "Berapa mata kejuaraan yang diperoleh sebuah kemenangan perlumbaan?",
        options: ["10", "20", "25", "30"],
        correctIndex: 2,
        explanation: "25 mata untuk tempat pertama, menurun sehingga 1 mata untuk tempat kesepuluh (18-15-12-10-8-6-4-2-1).",
      },
      {
        id: "fastest-lap-point",
        question: "Adakah masih ada mata bonus untuk pusingan terpantas perlumbaan?",
        options: [
          "Ya, jika finis dalam 10 teratas",
          "Tiada — dimansuhkan selepas musim 2024",
          "Ya, untuk sesiapa sahaja di litar",
          "Hanya dalam perlumbaan sprint",
        ],
        correctIndex: 1,
        explanation:
          "Mata bonus pusingan terpantas dimansuhkan bermula musim 2025 — kedudukan finis sahaja kini menentukan mata.",
      },
      {
        id: "drs-replacement",
        question: "Apakah yang menggantikan DRS untuk musim 2026?",
        options: [
          "Tiada apa-apa — DRS kekal sama",
          "Mod Overtake, sebahagian daripada sistem aerodinamik aktif baharu",
          "Butang push-to-pass",
          "DRS khas sprint sahaja",
        ],
        correctIndex: 1,
        explanation:
          "Peraturan 2026 F1 memansuhkan DRS kepak sayap belakang tunggal selepas 14 musim, digantikan dengan aerodinamik aktif yang melaraskan kedua-dua sayap.",
      },
      {
        id: "mandatory-compounds",
        question: "Dalam perlumbaan kering, berapa kompaun tayar berbeza yang wajib digunakan seorang pemandu?",
        options: ["1", "2", "3", "Tiada — pilihan sahaja"],
        correctIndex: 1,
        explanation:
          "Sekurang-kurangnya dua kompaun kering berbeza wajib digunakan dalam perlumbaan kering, yang menjamin sekurang-kurangnya satu masuk pit.",
      },
      {
        id: "yellow-flag",
        question: "Apakah maksud bendera kuning?",
        options: [
          "Perlumbaan tamat",
          "Benarkan kereta lebih pantas melepasi",
          "Perlahankan, dilarang memotong — bahaya di hadapan",
          "Masuk pit sekarang",
        ],
        correctIndex: 2,
        explanation: "Kuning ialah amaran: perlahankan dan jangan memotong sehingga anda melepasi bahaya.",
      },
      {
        id: "safety-car-effect",
        question: "Apakah kesan kereta keselamatan terhadap barisan kereta?",
        options: [
          "Menamatkan sesi",
          "Mengumpulkan semua kereta di belakangnya pada kelajuan rendah",
          "Menambah masuk pit wajib",
          "Hanya melambatkan peneraju",
        ],
        correctIndex: 1,
        explanation:
          "Ia meneutralkan perlumbaan — barisan kereta rapat di belakangnya, sebab itulah masuk pit semasa ini kos masa jauh lebih sedikit.",
      },
      {
        id: "softest-compound",
        question: "Kompaun tayar manakah yang paling lembut?",
        options: ["C1", "C3", "C5", "Semuanya sama lembut"],
        correctIndex: 2,
        explanation: "C1 ialah yang paling keras daripada lima kompaun, C5 yang paling lembut.",
      },
      {
        id: "undercut-def",
        question: 'Apakah maksud "undercut"?',
        options: [
          "Kekal di litar lebih lama daripada pesaing",
          "Masuk pit sebelum pesaing untuk tayar lebih segar dan pantas",
          "Sejenis kerb",
          "Memotong semasa kereta keselamatan",
        ],
        correctIndex: 1,
        explanation:
          "Masuk pit dahulu, dan kelajuan tambahan tayar baharu mungkin cukup untuk mendahului pesaing sebaik sahaja mereka akhirnya masuk pit.",
      },
      {
        id: "sprint-points",
        question: "Berapa ramai pemandu yang finis mendapat mata dalam perlumbaan sprint F1?",
        options: ["3 teratas", "8 teratas", "10 teratas", "Semua yang finis"],
        correctIndex: 1,
        explanation:
          "Sprint memberi mata kepada 8 teratas, 8-7-6-5-4-3-2-1 — skala lebih pendek berbanding 10 teratas dalam perlumbaan penuh.",
      },
      {
        id: "sepang-length",
        question: "Berapa panjang satu pusingan Litar Antarabangsa Sepang?",
        options: ["3.4 km", "4.8 km", "5.543 km", "6.2 km"],
        correctIndex: 2,
        explanation: "5.543 km, 15 selekoh — angka yang sama di sebalik setiap peta litar dan statistik di laman ini.",
      },
    ],
  },
  quizUi: {
    questionOf: "Soalan {current} / {total}",
    score: "Skor",
    correct: "Betul. ",
    notQuite: "Kurang tepat. ",
    correctSuffix: " — Betul",
    yourAnswerSuffix: " — Jawapan anda",
    nextQuestion: "Soalan seterusnya",
    seeResults: "Lihat keputusan",
    quizComplete: "Kuiz selesai",
    cleanSweep: "Sapu bersih — anda arif tentang peraturan semasa.",
    tryAgain: "Cuba sekali lagi — penjelasan setiap soalan kekal dipaparkan selepas anda menjawab.",
    playAgain: "Main semula",
  },
};
