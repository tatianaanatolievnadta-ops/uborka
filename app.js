(() => {
  "use strict";

  const STORAGE_KEY = "multiHouseCleaner_v1";
  const FIRST_LAUNCH_KEY = "multiHouseCleaner_firstLaunch";
  const USERS_KEY = "multiHouseCleaner_users";
  const SESSION_KEY = "multiHouseCleaner_session";
  const LEGACY_MIGRATED_KEY = "multiHouseCleaner_legacyMigrated";
  const NOTIF_DAILY_KEY = "multiHouseCleaner_notifDailySummary";
  const DAY_MARK_KEY = "multiHouseCleaner_dayMark";

  // Supabase (опционально): без ключа работает localStorage
  const SUPABASE_URL = "https://wapnyeblryyxotnavnae.supabase.co";
  const SUPABASE_ANON_KEY =
    window.__SUPABASE_ANON_KEY__ ||
    "ВСТАВЬТЕ_СЮДА_ANON_KEY_ИЗ_DASHBOARD_SUPABASE";

  function isSupabaseReady() {
    return (
      typeof window !== "undefined" &&
      window.supabase &&
      SUPABASE_ANON_KEY &&
      !String(SUPABASE_ANON_KEY).includes("ВСТАВЬТЕ")
    );
  }

  let supabase = null;
  if (isSupabaseReady()) {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (e) {
      console.warn("Supabase init failed:", e);
      supabase = null;
    }
  }

  const TRIAL_DAYS = 14;
  const UI_RETENTION_DAYS = 60;
  const CODE_RETENTION_DAYS = 90;
  const MAX_HOUSES_STANDARD = 1;
  const MAX_HOUSES_PREMIUM = 5;
  const SKIP_WARN_AT = 3;
  const SKIP_RED_AT = 2;
  const POINTS_PER_TASK = 10;
  const REFERRAL_BASE_URL = "https://tatianaanatolievnadta-ops.github.io/uborka/";
  const REFERRAL_BONUS_DAYS = 3;

  const LEVEL_TIERS = [
    { min: 0, max: 100, name: "Новичок" },
    { min: 101, max: 300, name: "Чистюля" },
    { min: 301, max: 600, name: "Мастер уборки" },
    { min: 601, max: 1000, name: "Гуру чистоты" },
    { min: 1001, max: Infinity, name: "Легенда чистоты" },
  ];

  const TONE_OPTIONS = [
    { id: "supportive", label: "😊 Поддерживающий" },
    { id: "strict", label: "🗣️ Приказной" },
    { id: "friendly", label: "🤝 Дружеский" },
    { id: "clear", label: "📋 Чёткий исполнитель" },
  ];

  const MS_DAY = 86400000;

  const UNIVERSAL_ACTIONS = ["Протереть пыль", "Помыть пол", "Пропылесосить"];

  const EXTRA_ACTIONS = [
    "Сменить гардероб на лето/зиму",
    "Убрать на полке (в ящике)",
  ];

  const SHELF_TASK_NAME = "Убрать на полке (в ящике)";

  const SHELF_LOCATIONS = ["шкаф", "комод", "тумбочка", "стеллаж", "антресоль"];

  const DEFAULT_TASK_IMAGE = "https://cdn-icons-png.flaticon.com/512/3095/3095111.png";

  const TASK_IMAGE_BY_KEYWORD = [
    { keys: ["пол", "полы"], url: "https://cdn-icons-png.flaticon.com/512/3095/3095118.png" },
    { keys: ["окно", "стекло"], url: "https://cdn-icons-png.flaticon.com/512/3095/3095110.png" },
    { keys: ["пыль"], url: "https://cdn-icons-png.flaticon.com/512/3095/3095115.png" },
    { keys: ["плита", "кухня"], url: "https://cdn-icons-png.flaticon.com/512/3095/3095125.png" },
    { keys: ["унитаз", "ванна"], url: "https://cdn-icons-png.flaticon.com/512/3095/3095128.png" },
    { keys: ["раковина"], url: "https://cdn-icons-png.flaticon.com/512/3095/3095120.png" },
    { keys: ["стирка", "шторы"], url: "https://cdn-icons-png.flaticon.com/512/3095/3095132.png" },
    { keys: ["шкаф", "комод", "полка"], url: "https://cdn-icons-png.flaticon.com/512/3095/3095135.png" },
    { keys: ["гардероб", "одежда"], url: "https://cdn-icons-png.flaticon.com/512/3095/3095130.png" },
  ];

  const ROOM_ACTIONS = {
    kitchen: [
      "Вымыть раковину",
      "Помыть полы",
      "Пропылесосить",
      "Вымыть окно",
      "Протереть подоконник",
      "Вымыть газовую плиту",
      "Вымыть микроволновую печь",
      "Протереть кухонный гарнитур",
      "Вымыть холодильник",
      "Протереть стол",
    ],
    bedroom: [
      "Заправить постель",
      "Вымыть пол",
      "Протереть пыль",
      "Постирать шторы",
      "Протереть зеркало",
      "Пропылесосить ковёр",
      "Проветрить",
    ],
    bathroom: [
      "Вымыть ванну",
      "Почистить унитаз",
      "Протереть зеркало",
      "Помыть пол",
      "Почистить раковину",
      "Протереть смесители",
      "Почистить стиральную машину",
    ],
    living: [
      "Пропылесосить",
      "Протереть пыль",
      "Вымыть пол",
      "Протереть окна",
      "Почистить мягкую мебель",
      "Проветрить",
    ],
    hallway: ["Протереть пыль", "Помыть пол", "Протереть зеркало", "Почистить обувницу"],
    balcony: ["Помыть пол", "Протереть подоконник", "Проветрить"],
  };

  function uid() {
    return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function daysBetween(fromIso, toDate = new Date()) {
    const a = new Date(fromIso);
    a.setHours(0, 0, 0, 0);
    const b = new Date(toDate);
    b.setHours(0, 0, 0, 0);
    return Math.floor((b - a) / MS_DAY);
  }

  function hoursUntil(targetDate) {
    return Math.max(0, Math.ceil((targetDate - Date.now()) / 3600000));
  }

  function defaultImageForTaskName(taskName) {
    const n = String(taskName || "").toLowerCase();
    for (const entry of TASK_IMAGE_BY_KEYWORD) {
      if (entry.keys.some((k) => n.includes(k))) return entry.url;
    }
    return DEFAULT_TASK_IMAGE;
  }

  function getTaskDisplayImage(task) {
    const rec = task?.recommendations || {};
    const custom = String(rec.image || "").trim();
    if (custom) return custom;
    return defaultImageForTaskName(task?.name);
  }

  function isShelfTaskName(name) {
    const n = String(name || "").trim();
    return n === SHELF_TASK_NAME || n.includes("Убрать на полке");
  }

  function isFloorTaskName(name) {
    const n = String(name || "").toLowerCase();
    return (
      n.includes("помыть пол") ||
      n.includes("помыть полы") ||
      n.includes("вымыть пол")
    );
  }

  function calcRoomArea(width, length) {
    const w = Number(width);
    const l = Number(length);
    if (!w || !l || w <= 0 || l <= 0) return null;
    return Math.round(w * l * 100) / 100;
  }

  function defaultRecommendations(taskName) {
    const n = String(taskName || "").toLowerCase().trim();

    const rules = [
      {
        keys: ["заправить", "постел", "кровать"],
        means: "Не требуется",
        inventory: "Не требуется",
        motions:
          "Встряхните простыню и ровно заправьте углы под матрас. Расправьте одеяло или плед, поправьте подушки, разгладьте складки — сверху вниз от изголовья.",
      },
      {
        keys: ["помыть пол", "помыть полы", "вымыть пол", "вымыть полы"],
        means: "Универсальное средство для пола или вода с уксусом",
        inventory: "Швабра, ведро, тряпка из микрофибры",
        motions: "От дальнего угла к выходу, восьмёрками, не заходя на мокрое",
      },
      {
        keys: ["пропылесос"],
        means: "Не требуется",
        inventory: "Пылесос, насадки",
        motions: "Сначала уберите крупный мусор, затем пылесосьте от дальних углов к выходу, не забывая плинтусы",
      },
      {
        keys: ["пыль"],
        means: "Антистатический спрей или слегка влажная салфетка",
        inventory: "Микрофибра, стремянка при необходимости",
        motions: "Сверху вниз, не круговыми движениями — чтобы не размазать",
      },
      {
        keys: ["раковин"],
        means: "Крем-чистящее для сантехники, сода",
        inventory: "Губка, старая зубная щётка для смесителя",
        motions: "Нанести — подождать 2–3 мин — круговыми движениями — сполоснуть",
      },
      {
        keys: ["унитаз"],
        means: "Гель для унитаза или чистящее для сантехники",
        inventory: "Ёршик, перчатки, тряпка для сиденья",
        motions: "Нанести средство под ободок, почистить ёршиком, протереть сиденье и кнопки, смыть",
      },
      {
        keys: ["ванн", "душ"],
        means: "Средство от известкового налёта / для акрила или эмали",
        inventory: "Губка, перчатки",
        motions: "Нанести — подождать — потереть стенки и дно — смыть водой",
      },
      {
        keys: ["зеркал"],
        means: "Спрей для стёкол или вода с уксусом",
        inventory: "Салфетка из микрофибры",
        motions: "Распылить на салфетку (не на зеркало), протереть вертикальными движениями до блеска",
      },
      {
        keys: ["окн", "стекл"],
        means: "Спрей для стёкол",
        inventory: "Салфетка из микрофибры, водосгон",
        motions: "Сначала рамы, затем стекло сверху вниз; насухо вытереть, чтобы не осталось разводов",
      },
      {
        keys: ["проветрить"],
        means: "Не требуется",
        inventory: "Не требуется",
        motions: "Откройте окна на 5–15 минут, выключите обогреватели у открытых окон, затем закройте",
      },
      {
        keys: ["штор"],
        means: "Стиральный порошок или гель для ткани штор",
        inventory: "Таз / стиральная машина, прищепки",
        motions: "Снять шторы, постирать по режиму ткани, высушить и повесить обратно",
      },
      {
        keys: ["гардероб", "сезон"],
        means: "Не требуется",
        inventory: "Вешалки, коробки для хранения, мешки для стирки",
        motions: "Достать сезонные вещи, сложить несезонные, проверить чистоту перед хранением",
      },
      {
        keys: ["полк", "ящик"],
        means: "Не требуется",
        inventory: "Коробки, корзины, салфетка",
        motions: "Разобрать полку по категориям, протереть пыль, вернуть нужное, лишнее убрать",
      },
      {
        keys: ["плит", "духовк"],
        means: "Обезжириватель или сода с водой",
        inventory: "Губка, перчатки, старая зубная щётка",
        motions: "Снять решётки, нанести средство, подождать, оттереть нагар, сполоснуть",
      },
      {
        keys: ["холодильник"],
        means: "Сода с водой или мягкое средство для кухни",
        inventory: "Губка, тряпка, контейнеры для продуктов",
        motions: "Выключить, вынуть продукты, вымыть полки сверху вниз, протереть насухо, разложить обратно",
      },
      {
        keys: ["мягк", "диван", "кресл"],
        means: "Пенный очиститель для обивки или пылесос с насадкой",
        inventory: "Пылесос, щётка для мебели",
        motions: "Пропылесосить складки и щели, при необходимости нанести очиститель и промокнуть",
      },
      {
        keys: ["обувниц"],
        means: "Влажная салфетка, при необходимости средство для кожи/замши",
        inventory: "Салфетка, щётка",
        motions: "Вынуть обувь, протереть полки, расставить обувь парами",
      },
    ];

    for (const rule of rules) {
      if (rule.keys.some((k) => n.includes(k))) {
        return {
          means: rule.means,
          inventory: rule.inventory,
          motions: rule.motions,
          image: "",
        };
      }
    }

    return {
      means: "Не требуется",
      inventory: "Не требуется",
      motions: "Выполните задачу аккуратно и полностью, затем отметьте выполнение",
      image: "",
    };
  }

  function isGenericRecommendation(rec) {
    if (!rec) return true;
    const inv = String(rec.inventory || "").toLowerCase();
    const means = String(rec.means || "").toLowerCase();
    return (
      inv.includes("тряпка, губка") ||
      inv.includes("тряпка, губка, перчатки") ||
      means.includes("подходящее чистящее средство по типу поверхности") ||
      means.includes("подбирайте средство")
    );
  }

  function refreshTaskRecommendations(task) {
    if (!task?.name) return;
    const fresh = defaultRecommendations(task.name);
    const n = String(task.name).toLowerCase();
    const isBedMake = n.includes("заправить") || n.includes("постел");
    const isAir = n.includes("проветрить");
    const shouldReplace =
      !task.recommendations ||
      isGenericRecommendation(task.recommendations) ||
      ((isBedMake || isAir) &&
        /тряпк|губк|швабр|перчатк|чистящ/i.test(
          `${task.recommendations.inventory || ""} ${task.recommendations.means || ""}`
        ));

    if (shouldReplace) {
      task.recommendations = {
        ...fresh,
        image: task.recommendations?.image || "",
      };
    }
    if (!Array.isArray(task.products)) task.products = [];
    if ((isBedMake || isAir) && task.products.length) {
      task.products = [];
    }
  }

  function defaultProducts(taskName) {
    const catalog = {
      "Помыть пол": [
        {
          id: uid(),
          name: "Средство для пола Synergetic",
          url: "https://www.ozon.ru/",
          price: "349 ₽",
        },
      ],
      "Протереть пыль": [
        {
          id: uid(),
          name: "Салфетки из микрофибры 5 шт",
          url: "https://www.wildberries.ru/",
          price: "299 ₽",
        },
      ],
      "Вымыть раковину": [
        {
          id: uid(),
          name: "Cif крем универсальный",
          url: "https://www.ozon.ru/",
          price: "189 ₽",
        },
      ],
    };
    return catalog[taskName] || [];
  }

  function makeTask(name, priority = "green", minutes = 15, period = { type: "days", count: 1, value: 7 }) {
    return {
      id: uid(),
      name,
      priority,
      skipCount: 0,
      estimatedMinutes: minutes,
      period,
      createdAt: new Date().toISOString(),
      lastCompleted: null,
      completedToday: false,
      lastTimedSeconds: null,
      location: null,
      floorArea: null,
      recommendations: defaultRecommendations(name),
      products: defaultProducts(name),
      showRec: false,
    };
  }

  function makeRoom(name, tasks, width = null, length = null) {
    const area = calcRoomArea(width, length);
    return { id: uid(), name, tasks, width, length, area };
  }

  function makeDefaultHouse(name) {
    return {
      id: uid(),
      name,
      rooms: [
        makeRoom("Кухня", [
          makeTask("Помыть пол", "yellow", 20),
          makeTask("Вымыть раковину", "green", 10),
        ]),
        makeRoom("Ванная", [
          makeTask("Вымыть раковину", "yellow", 10),
          makeTask("Помыть пол", "green", 15),
        ]),
        makeRoom("Гостиная", [
          makeTask("Протереть пыль", "green", 15),
          makeTask("Помыть пол", "red", 25),
        ]),
      ],
    };
  }

  function createFreshState() {
    const now = new Date().toISOString();
    return {
      houses: [makeDefaultHouse("Моя квартира")],
      subscription: {
        status: "trial",
        trialStartDate: now,
        planType: "premium",
        billing: null,
      },
      lastVisitDate: now,
      deletionWarningShown: false,
      activeHouseId: null,
      gamification: createDefaultGamification(),
    };
  }

  function createDefaultGamification() {
    return {
      points: 0,
      actionStats: {},
      rewardHistory: [],
      tone: "supportive",
      avatar: { type: "letter", value: "" },
      streakDays: 0,
      dailyLog: {},
      todaySkips: 0,
      todayKey: new Date().toDateString(),
      rewardsShown: {},
      messyHouseShown: false,
      totalFloorAreaCleaned: 0,
    };
  }

  // ——— State ———
  let state = null;
  let currentUser = null;
  let ui = {
    screen: "auth", // auth | app | deleted
    tab: "homes",
    view: "houses",
    planView: "rooms", // rooms | room | today | calendar
    activeHouseId: null,
    activeRoomId: null,
    calendar: { mode: "day", date: new Date().toISOString(), pickMonth: null },
    modal: null,
    toastTimer: null,
    stopwatch: { running: false, startedAt: 0, elapsed: 0, taskRef: null, tick: null },
    critTick: null,
    authError: "",
    authLoading: false,
    confetti: false,
    justCompletedId: null,
  };

  const PROVIDER_LABELS = {
    google: "Google",
    vk: "VK",
    telegram: "Telegram",
    email: "Почта",
  };

  // ——— Supabase data layer ———
  function getUserId() {
    return currentUser?.id || null;
  }

  function getStateKey(userId) {
    const id = userId || currentUser?.id || loadSession()?.userId;
    return id ? `${STORAGE_KEY}_${id}` : STORAGE_KEY;
  }

  function migrateLegacyState(userId) {
    if (!userId) return;
    // Старый общий ключ переносим только один раз — первому вошедшему пользователю
    if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return;
    const userKey = getStateKey(userId);
    if (localStorage.getItem(userKey)) {
      localStorage.setItem(LEGACY_MIGRATED_KEY, userId);
      return;
    }
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      localStorage.setItem(userKey, legacy);
      localStorage.removeItem(STORAGE_KEY);
    }
    localStorage.setItem(LEGACY_MIGRATED_KEY, userId);
  }

  function accountDisplay(user) {
    if (!user) return "—";
    if (user.provider === "email" && user.email) return user.email;
    const via = PROVIDER_LABELS[user.provider] || user.provider || "соцсеть";
    return `Вход через ${via}`;
  }

  function findSocialUser(provider, name) {
    const key = String(name || "")
      .trim()
      .toLowerCase();
    if (!key) return null;
    return (
      loadUsers().find(
        (u) => u.provider === provider && String(u.name || "").trim().toLowerCase() === key
      ) || null
    );
  }

  function socialAccountEmail(provider, name) {
    const slug = String(name || "user")
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 32) || "user";
    return `${slug}@${provider}.local`;
  }

  function normalizeAppState(raw) {
    const fresh = createFreshState();
    if (!raw || typeof raw !== "object") return fresh;
    const stateObj = { ...fresh, ...raw };
    if (!Array.isArray(stateObj.houses) || !stateObj.houses.length) {
      stateObj.houses = fresh.houses;
    }
    if (!stateObj.subscription) stateObj.subscription = fresh.subscription;
    if (!stateObj.lastVisitDate) stateObj.lastVisitDate = fresh.lastVisitDate;
    if (!stateObj.gamification) stateObj.gamification = createDefaultGamification();
    return stateObj;
  }

  function loadState(userId) {
    try {
      const key = getStateKey(userId);
      let raw = localStorage.getItem(key);
      if (!raw && userId) {
        migrateLegacyState(userId);
        raw = localStorage.getItem(key);
      }
      if (!raw) return null;
      return normalizeAppState(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function loadStateForUser(userId, preferFresh) {
    if (preferFresh) {
      markFirstLaunch();
      return createFreshState();
    }
    const existing = loadState(userId);
    if (!existing) {
      markFirstLaunch();
      return createFreshState();
    }
    return existing;
  }

  function loadUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }

  function getUserById(id) {
    return loadUsers().find((u) => u.id === id) || null;
  }

  function getUserByEmail(email) {
    const key = String(email || "").trim().toLowerCase();
    if (!key) return null;
    return loadUsers().find((u) => String(u.email || "").toLowerCase() === key) || null;
  }

  function upsertUser(user) {
    const users = loadUsers();
    const i = users.findIndex((u) => u.id === user.id);
    if (i >= 0) users[i] = user;
    else users.push(user);
    saveUsers(users);
    return user;
  }

  function defaultNotifSettings() {
    return { enabled: false, permission: "default", permissionRequested: false };
  }

  function taskFromRow(t) {
    return {
      id: t.id,
      name: t.name,
      priority: t.priority || "green",
      skipCount: t.skip_count || 0,
      estimatedMinutes: t.estimated_minutes ?? 15,
      period: t.period || { type: "days", count: 1, value: 7 },
      createdAt: t.created_at,
      lastCompleted: t.last_completed,
      completedToday: !!t.completed_today,
      lastTimedSeconds: t.last_timed_seconds,
      location: t.location || null,
      floorArea: t.floor_area != null ? Number(t.floor_area) : null,
      recommendations: t.recommendations || {},
      products: t.products || [],
      showRec: !!t.show_rec,
    };
  }

  function taskToRow(task, roomId, userId) {
    return {
      id: task.id,
      user_id: userId,
      room_id: roomId,
      name: task.name,
      priority: task.priority || "green",
      skip_count: task.skipCount || 0,
      estimated_minutes: task.estimatedMinutes ?? 15,
      period: task.period || { type: "days", count: 1, value: 7 },
      created_at: task.createdAt || new Date().toISOString(),
      last_completed: task.lastCompleted,
      completed_today: !!task.completedToday,
      last_timed_seconds: task.lastTimedSeconds,
      location: task.location || null,
      floor_area: task.floorArea != null ? Number(task.floorArea) : null,
      recommendations: task.recommendations || {},
      products: task.products || [],
      show_rec: !!task.showRec,
    };
  }

  function roomFromRow(r, tasks) {
    return {
      id: r.id,
      name: r.name,
      width: r.width,
      length: r.length,
      area: r.area,
      tasks: (tasks || []).filter((t) => t.room_id === r.id).map(taskFromRow),
    };
  }

  function nestUserData(profile, houses, rooms, tasks, authUser) {
    const nestedHouses = (houses || []).map((h) => ({
      id: h.id,
      name: h.name,
      rooms: (rooms || [])
        .filter((r) => r.house_id === h.id)
        .map((r) => roomFromRow(r, tasks)),
    }));

    const sub = profile?.subscription || {
      status: "trial",
      trialStartDate: new Date().toISOString(),
      planType: "premium",
      billing: null,
      bonusDays: 0,
    };
    if (sub.trialStartDate && typeof sub.trialStartDate !== "string") {
      sub.trialStartDate = new Date(sub.trialStartDate).toISOString();
    }

    return {
      houses: nestedHouses,
      subscription: sub,
      lastVisitDate: profile?.last_visit_date || new Date().toISOString(),
      deletionWarningShown: !!profile?.deletion_warning_shown,
      activeHouseId: profile?.active_house_id || nestedHouses[0]?.id || null,
      gamification: profile?.gamification || createDefaultGamification(),
      profile: {
        name: profile?.name || authUser?.user_metadata?.name || "Пользователь",
        email: authUser?.email || "",
        provider: profile?.provider || "email",
      },
      notifSettings: profile?.notif_settings || defaultNotifSettings(),
    };
  }

  async function loadUserData() {
    if (!isSupabaseReady() || !supabase) return null;

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return null;

    const userId = user.id;
    const [profileRes, housesRes, roomsRes, tasksRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("houses").select("*").eq("user_id", userId),
      supabase.from("rooms").select("*").eq("user_id", userId),
      supabase.from("tasks").select("*").eq("user_id", userId),
    ]);

    if (profileRes.error) console.error("load profile", profileRes.error);
    if (housesRes.error) console.error("load houses", housesRes.error);
    if (roomsRes.error) console.error("load rooms", roomsRes.error);
    if (tasksRes.error) console.error("load tasks", tasksRes.error);

    return nestUserData(
      profileRes.data,
      housesRes.data || [],
      roomsRes.data || [],
      tasksRes.data || [],
      user
    );
  }

  async function saveProfile() {
    if (!isSupabaseReady() || !supabase) return;
    const userId = getUserId();
    if (!userId || !state) return;
    const row = {
      user_id: userId,
      name: state.profile?.name || currentUser?.name,
      provider: state.profile?.provider || currentUser?.provider || "email",
      subscription: state.subscription,
      gamification: state.gamification || createDefaultGamification(),
      last_visit_date: state.lastVisitDate,
      deletion_warning_shown: !!state.deletionWarningShown,
      active_house_id: state.activeHouseId,
      referral_code: currentUser?.referralCode || userId,
      referrals_count: currentUser?.referralsCount || 0,
      referral_bonus_days: currentUser?.referralBonusDays || 0,
      referred_by: currentUser?.referredBy || null,
      notif_settings: state.notifSettings || defaultNotifSettings(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").upsert(row);
    if (error) console.error("saveProfile", error);
  }

  async function saveHouse(house) {
    if (!isSupabaseReady() || !supabase) return;
    const userId = getUserId();
    if (!userId || !house) return;
    const { error } = await supabase.from("houses").upsert({
      id: house.id,
      user_id: userId,
      name: house.name,
    });
    if (error) console.error("saveHouse", error);
    for (const room of house.rooms || []) {
      await upsertRoomToDb(room, house.id);
    }
  }

  async function upsertRoomToDb(room, houseId) {
    if (!isSupabaseReady() || !supabase) return;
    const userId = getUserId();
    if (!userId || !room) return;
    const hid = houseId || findHouseIdForRoom(room.id);
    if (!hid) return;
    const area = calcRoomArea(room.width, room.length);
    room.area = area;
    const { error } = await supabase.from("rooms").upsert({
      id: room.id,
      user_id: userId,
      house_id: hid,
      name: room.name,
      width: room.width ?? null,
      length: room.length ?? null,
      area: area,
    });
    if (error) console.error("upsertRoomToDb", error);
    for (const task of room.tasks || []) {
      await upsertTaskToDb(task, room.id);
    }
  }

  async function upsertTaskToDb(task, roomId) {
    if (!isSupabaseReady() || !supabase) return;
    const userId = getUserId();
    if (!userId || !task) return;
    const rid = roomId || findRoomIdForTask(task.id);
    if (!rid) return;
    const { error } = await supabase.from("tasks").upsert(taskToRow(task, rid, userId));
    if (error) console.error("upsertTaskToDb", error);
  }

  async function deleteHouse(id) {
    if (!isSupabaseReady() || !supabase) return;
    const userId = getUserId();
    if (!userId) return;
    const { error } = await supabase.from("houses").delete().eq("id", id).eq("user_id", userId);
    if (error) console.error("deleteHouse", error);
  }

  async function deleteRoom(id) {
    if (!isSupabaseReady() || !supabase) return;
    const userId = getUserId();
    if (!userId) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id).eq("user_id", userId);
    if (error) console.error("deleteRoom", error);
  }

  async function deleteTask(id) {
    if (!isSupabaseReady() || !supabase) return;
    const userId = getUserId();
    if (!userId) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId);
    if (error) console.error("deleteTask", error);
  }

  function findHouseIdForRoom(roomId) {
    if (!state?.houses) return null;
    for (const house of state.houses) {
      if (house.rooms.some((r) => r.id === roomId)) return house.id;
    }
    return null;
  }

  function findRoomIdForTask(taskId) {
    const found = findTask(taskId);
    return found?.room?.id || null;
  }

  async function seedDefaultDataToDb(appState) {
    if (!isSupabaseReady() || !supabase) return;
    await saveProfile();
    for (const house of appState.houses || []) {
      await saveHouse(house);
    }
  }

  async function wipeUserDataFromDb() {
    if (!isSupabaseReady() || !supabase) return;
    const userId = getUserId();
    if (!userId) return;
    await supabase.from("houses").delete().eq("user_id", userId);
    const fresh = createFreshState();
    state = {
      ...fresh,
      profile: state?.profile || {},
    };
    state.activeHouseId = state.houses[0].id;
    await seedDefaultDataToDb(state);
  }

  let saveProfileTimer = null;
  function saveState() {
    if (!state) return;
    try {
      const key = getStateKey();
      localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.error("saveState local", e);
    }
    if (currentUser && isSupabaseReady() && supabase) {
      clearTimeout(saveProfileTimer);
      saveProfileTimer = setTimeout(() => {
        saveProfile().catch((e) => console.error(e));
      }, 300);
    }
  }

  function saveStateNow() {
    return saveProfile();
  }

  function mapAuthUser(user) {
    return {
      id: user.id,
      email: user.email || "",
      name: user.user_metadata?.name || user.email?.split("@")[0] || "Пользователь",
      provider: user.app_metadata?.provider === "email" ? "email" : user.app_metadata?.provider || "email",
      referralCode: user.id,
      referralsCount: 0,
      referralBonusDays: 0,
      referredBy: null,
    };
  }

  async function mergeProfileIntoUser(user) {
    if (!isSupabaseReady() || !supabase) return user;
    const { data: profile } = await supabase
      .from("profiles")
      .select("referrals_count, referral_bonus_days, referred_by, referral_code, name, provider")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile) {
      user.referralCode = profile.referral_code || user.id;
      user.referralsCount = profile.referrals_count || 0;
      user.referralBonusDays = profile.referral_bonus_days || 0;
      user.referredBy = profile.referred_by;
      if (profile.name) user.name = profile.name;
      if (profile.provider) user.provider = profile.provider;
    }
    return user;
  }

  function isFirstLaunchDone() {
    return localStorage.getItem(FIRST_LAUNCH_KEY) === "1";
  }

  function markFirstLaunch() {
    localStorage.setItem(FIRST_LAUNCH_KEY, "1");
  }

  async function hardWipeKeepFirstLaunch() {
    if (isSupabaseReady() && supabase) {
      await wipeUserDataFromDb();
      return;
    }
    const kept = localStorage.getItem(FIRST_LAUNCH_KEY);
    const users = localStorage.getItem(USERS_KEY);
    const session = localStorage.getItem(SESSION_KEY);
    const userStateKey = getUserId() ? getStateKey() : null;
    const preservedUserStates = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${STORAGE_KEY}_`) && key !== userStateKey) {
        preservedUserStates[key] = localStorage.getItem(key);
      }
    }
    localStorage.clear();
    if (kept) localStorage.setItem(FIRST_LAUNCH_KEY, kept);
    if (users) localStorage.setItem(USERS_KEY, users);
    if (session) localStorage.setItem(SESSION_KEY, session);
    for (const [key, val] of Object.entries(preservedUserStates)) {
      if (val != null) localStorage.setItem(key, val);
    }
  }

  function getActiveHouse() {
    if (!state?.houses?.length) return null;
    const id = ui.activeHouseId || state.activeHouseId || state.houses[0].id;
    return state.houses.find((h) => h.id === id) || state.houses[0];
  }

  function maxHousesAllowed() {
    const { status, planType } = state.subscription;
    if (status === "trial") return MAX_HOUSES_PREMIUM;
    if (status === "active" && planType === "premium") return MAX_HOUSES_PREMIUM;
    if (status === "active" && planType === "standard") return MAX_HOUSES_STANDARD;
    return MAX_HOUSES_STANDARD;
  }

  function trialDaysLeft() {
    const bonus = (state.subscription.bonusDays || 0) + (currentUser?.referralBonusDays || 0);
    const used = daysBetween(state.subscription.trialStartDate);
    return Math.max(0, TRIAL_DAYS + bonus - used);
  }

  function refreshSubscriptionStatus() {
    const sub = state.subscription;
    if (sub.status === "active") return;
    if (sub.status === "trial" && trialDaysLeft() <= 0) {
      sub.status = "expired";
    }
  }

  function inactivityDays() {
    return daysBetween(state.lastVisitDate);
  }

  function uiDaysUntilDeletion() {
    if (ui.sessionDaysUntilDeletion != null) return ui.sessionDaysUntilDeletion;
    return Math.max(0, UI_RETENTION_DAYS - inactivityDays());
  }

  function uiDeletionDeadline() {
    if (ui.sessionDeletionDeadline) return ui.sessionDeletionDeadline;
    const d = new Date(state.lastVisitDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + UI_RETENTION_DAYS);
    return d;
  }

  function findTask(taskId) {
    for (const house of state.houses) {
      for (const room of house.rooms) {
        const task = room.tasks.find((t) => t.id === taskId);
        if (task) return { house, room, task };
      }
    }
    return null;
  }

  function findRoomById(roomId) {
    for (const house of state.houses) {
      const room = house.rooms.find((r) => r.id === roomId);
      if (room) return { house, room };
    }
    return null;
  }

  function normalizeRoomKey(roomName) {
    const n = String(roomName || "").toLowerCase().trim();
    if (n.includes("кухн")) return "kitchen";
    if (n.includes("спальн") || n.includes("гостев")) return "bedroom";
    if (n.includes("ванн") || n.includes("сануз") || n.includes("туал")) return "bathroom";
    if (n.includes("зал") || n.includes("гостин")) return "living";
    if (n.includes("корид") || n.includes("прихож")) return "hallway";
    if (n.includes("балкон") || n.includes("лодж")) return "balcony";
    return "default";
  }

  function getRoomActions(roomName) {
    const key = normalizeRoomKey(roomName);
    const base =
      key === "default"
        ? [...UNIVERSAL_ACTIONS]
        : ROOM_ACTIONS[key]
          ? [...ROOM_ACTIONS[key]]
          : [...UNIVERSAL_ACTIONS];
    for (const action of EXTRA_ACTIONS) {
      if (!base.includes(action)) base.push(action);
    }
    return base;
  }

  function startOfDay(d = new Date()) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function normalizePeriod(task) {
    if (task?.period?.type) {
      const p = { ...task.period };
      if (p.type === "monthly") return { type: "days", count: 1, value: 30 };
      if (p.type === "halfyear") return { type: "days", count: 1, value: 180 };
      if (p.type === "days") {
        if (p.count == null) p.count = 1;
        if (p.value == null) p.value = p.value ?? 7;
        return p;
      }
      return p;
    }
    if (task?.frequencyDays != null) {
      if (task.frequencyDays === 1) return { type: "daily" };
      return { type: "days", count: 1, value: task.frequencyDays };
    }
    return { type: "days", count: 1, value: 7 };
  }

  function periodLabel(task) {
    const p = normalizePeriod(task);
    if (p.type === "daily") return "Каждый день";
    if (p.type === "days") {
      const c = p.count || 1;
      const v = p.value || 1;
      const raz = c === 1 ? "раз" : c >= 2 && c <= 4 ? "раза" : "раз";
      return `${c} ${raz} в ${v} ${pluralDays(v)}`;
    }
    return "Каждый день";
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return startOfDay(d);
  }

  function setDayInMonth(baseDate, dayOfMonth, monthOffset) {
    const d = new Date(baseDate);
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(Math.max(1, dayOfMonth || 1), last));
    return startOfDay(d);
  }

  function calcNextDueDate(task) {
    const period = normalizePeriod(task);
    if (!task.lastCompleted) return startOfDay();

    const base = startOfDay(task.lastCompleted);
    switch (period.type) {
      case "daily":
        return addDays(base, 1);
      case "days":
        return addDays(base, period.value || 1);
      default:
        return addDays(base, 7);
    }
  }

  function dateKey(d) {
    const x = startOfDay(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }

  function parseDateKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return startOfDay(new Date(y, m - 1, d));
  }

  function getTaskAnchorDate(task) {
    if (task.lastCompleted) return startOfDay(task.lastCompleted);
    if (task.createdAt) return startOfDay(task.createdAt);
    return startOfDay();
  }

  function generateOccurrencesInRange(task, rangeStart, rangeEnd) {
    const dates = [];
    const p = normalizePeriod(task);
    const anchor = getTaskAnchorDate(task);
    const start = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);

    if (p.type === "daily") {
      let d = anchor < start ? new Date(start) : new Date(anchor);
      while (d <= end) {
        dates.push(new Date(d));
        d = addDays(d, 1);
      }
      return dates;
    }

    if (p.type === "days") {
      const interval = Math.max(1, p.value || 1);
      let d = new Date(anchor);
      if (d < start) {
        const diff = Math.floor((start - d) / MS_DAY);
        const steps = Math.ceil(diff / interval);
        d = addDays(anchor, steps * interval);
      }
      while (d <= end) {
        if (d >= anchor) dates.push(new Date(d));
        d = addDays(d, interval);
      }
    }
    return dates;
  }

  function isTaskScheduledOnDate(task, date) {
    const key = dateKey(date);
    return generateOccurrencesInRange(task, date, date).some((d) => dateKey(d) === key);
  }

  function getAllTasksFlat() {
    const list = [];
    if (!state?.houses) return list;
    for (const house of state.houses) {
      for (const room of house.rooms) {
        for (const task of room.tasks) {
          list.push({ house, room, task });
        }
      }
    }
    return list;
  }

  function getTasksForDate(date) {
    const list = [];
    for (const { house, room, task } of getAllTasksFlat()) {
      if (isTaskScheduledOnDate(task, date)) {
        list.push({ house, room, task });
      }
    }
    return list;
  }

  function countTasksInMonth(year, month) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const keys = new Set();
    for (const { task } of getAllTasksFlat()) {
      for (const d of generateOccurrencesInRange(task, start, end)) {
        keys.add(dateKey(d) + task.id);
      }
    }
    return keys.size;
  }

  function formatDateRu(d) {
    return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" });
  }

  const MONTH_NAMES = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];

  function isTaskDueToday(task) {
    if (task.completedToday) return true;
    const today = startOfDay();
    return today >= calcNextDueDate(task);
  }

  function migrateState() {
    if (!state?.houses) return;
    for (const house of state.houses) {
      for (const room of house.rooms) {
        for (const task of room.tasks) {
          if (!task.period) {
            if (task.frequencyDays == null) {
              task.period = { type: "days", count: 1, value: 7 };
            } else if (task.frequencyDays === 1) {
              task.period = { type: "daily" };
            } else {
              task.period = { type: "days", count: 1, value: task.frequencyDays };
            }
          } else {
            task.period = normalizePeriod(task);
          }
          if (!task.createdAt) task.createdAt = new Date().toISOString();
          if (task.location == null) task.location = null;
          if (task.floorArea == null) task.floorArea = null;
          delete task.frequencyDays;
          refreshTaskRecommendations(task);
        }
        if (room.width != null || room.length != null) {
          room.area = calcRoomArea(room.width, room.length);
        }
      }
    }
    if (!state.gamification) state.gamification = createDefaultGamification();
    if (state.gamification.totalFloorAreaCleaned == null) {
      state.gamification.totalFloorAreaCleaned = 0;
    }
    if (!state.subscription) {
      state.subscription = createFreshState().subscription;
    }
    if (!state.lastVisitDate) {
      state.lastVisitDate = new Date().toISOString();
    }
  }

  // ——— Gamification & messages ———
  const MESSAGES = {
    taskDone: {
      supportive: "Ты молодец! Ещё чуть-чуть — и будет идеально!",
      strict: "Так держать! Следующая задача — без промедления!",
      friendly: "Ну что, подружка, давай вместе — я с тобой!",
      clear: "Задача выполнена. Переходите к следующей.",
    },
    skipWarn: {
      supportive: "Ничего страшного, но эту задачу уже пора сделать — ты справишься!",
      strict: "Быстро убрать! Почему так медленно?",
      friendly: "Эй, не бросай — вместе быстрее справимся!",
      clear: "Задача пропущена 3 раза. Требуется выполнение.",
    },
    skipRed: {
      supportive: "Задача давно ждёт — давай вернёмся к ней?",
      strict: "Слишком много пропусков! Немедленно выполнить!",
      friendly: "Ой, эта задача уже краснеет — поможем ей?",
      clear: "Превышен лимит пропусков. Приоритет: высокий.",
    },
    welcomeBack: {
      supportive: "С возвращением, {name}! Рады видеть тебя снова!",
      strict: "На месте, {name}. Приступай к задачам.",
      friendly: "Привет, {name}! Как настроение — уберёмся?",
      clear: "Вход выполнен. Пользователь: {name}.",
    },
    accountCreated: {
      supportive: "Добро пожаловать! У тебя всё получится!",
      strict: "Аккаунт создан. Начинай работу.",
      friendly: "Ура, ты с нами! Поехали убираться!",
      clear: "Регистрация завершена. Можно приступать.",
    },
    remindSent: {
      supportive: "Напоминание отправлено — ты не забудешь!",
      strict: "Напоминание активировано. Выполнить задачу.",
      friendly: "Пинганула тебя — не забудь про задачку!",
      clear: "Уведомление отправлено.",
    },
    goldenStar: {
      supportive: "Невероятно! 7 дней без пропусков — ты звезда!",
      strict: "7 дней без пропусков. Заслуженная награда.",
      friendly: "Ура-ура! Неделя без пропусков — ты супер!",
      clear: "Серия 7 дней выполнена. Бонус начислен.",
    },
    messyHouse: {
      supportive: "Похоже, дом ждёт тебя — начнём с малого?",
      strict: "⚠️ Ты запустил дом! Пора браться за дело!",
      friendly: "Эй, домик скучает — давай наведём порядок!",
      clear: "⚠️ Ты запустил дом! Пора браться за дело!",
    },
    inactive30: {
      supportive: "Начни с малого — чистота начинается с первого взмаха тряпки! У тебя всё получится!",
      strict: "30 дней без активности. Начните с одной задачи.",
      friendly: "Давно не виделись! Один маленький шаг — и снова в ритме!",
      clear: "Долгое отсутствие. Рекомендуется начать с простой задачи.",
    },
    taskSuggest: {
      supportive: "Вот что можно успеть за {minutes} мин — ты справишься!",
      strict: "План на {minutes} минут. Выполнять по порядку.",
      friendly: "За {minutes} минут вместе успеем вот это!",
      clear: "Подборка задач на {minutes} мин.",
    },
    timerSaved: {
      supportive: "Время записано — отличный темп!",
      strict: "Время зафиксировано.",
      friendly: "Записала время — молодец!",
      clear: "Данные таймера сохранены.",
    },
  };

  function ensureGamification() {
    if (!state.gamification) state.gamification = createDefaultGamification();
    const g = state.gamification;
    const today = new Date().toDateString();
    if (g.todayKey !== today) {
      g.todayKey = today;
      g.todaySkips = 0;
    }
    return g;
  }

  function getTone() {
    return ensureGamification().tone || "supportive";
  }

  function getMessage(key, params = {}) {
    const tone = getTone();
    const pack = MESSAGES[key] || {};
    let text = pack[tone] || pack.supportive || "";
    Object.keys(params).forEach((k) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), params[k]);
    });
    return text;
  }

  function getLevelInfo(points) {
    const pts = Math.max(0, points || 0);
    for (let i = LEVEL_TIERS.length - 1; i >= 0; i--) {
      if (pts >= LEVEL_TIERS[i].min) {
        const tier = LEVEL_TIERS[i];
        const next = LEVEL_TIERS[i + 1];
        return {
          name: tier.name,
          points: pts,
          currentMin: tier.min,
          nextMin: next ? next.min : null,
          nextName: next ? next.name : null,
          progressPct: Math.min(100, Math.round((pts / 1000) * 100)),
        };
      }
    }
    return { name: "Новичок", points: pts, progressPct: 0, nextMin: 101, nextName: "Чистюля" };
  }

  function addRewardHistory(entry) {
    const g = ensureGamification();
    g.rewardHistory.unshift({
      id: uid(),
      date: new Date().toISOString(),
      ...entry,
    });
    if (g.rewardHistory.length > 50) g.rewardHistory.length = 50;
  }

  function addPoints(amount, title, kind = "reward") {
    const g = ensureGamification();
    g.points = Math.max(0, (g.points || 0) + amount);
    addRewardHistory({ title, points: amount, kind });
    saveState();
    return g.points;
  }

  function recordActionStat(actionName) {
    const g = ensureGamification();
    g.actionStats[actionName] = (g.actionStats[actionName] || 0) + 1;
  }

  function roomIcon(roomName) {
    const n = String(roomName || "").toLowerCase();
    if (n.includes("кухн")) return "🍳";
    if (n.includes("спальн")) return "🛏️";
    if (n.includes("гостин") || n.includes("зал")) return "🛋️";
    if (n.includes("ванн")) return "🚿";
    if (n.includes("туал") || n.includes("сануз")) return "🚽";
    if (n.includes("корид") || n.includes("прихож")) return "🚪";
    if (n.includes("балкон") || n.includes("лодж")) return "🌿";
    if (n.includes("гостев")) return "🛏️";
    return "🏠";
  }

  function roomDisplayName(roomName) {
    return `${roomIcon(roomName)} ${roomName}`;
  }

  function getAvatarHtml(user, g) {
    const av = g?.avatar || { type: "letter", value: "" };
    if (av.type === "upload" && av.value) {
      return `<img class="avatar-img" src="${av.value}" alt="Аватар" />`;
    }
    const letter = (user?.name || "?").trim().charAt(0).toUpperCase() || "?";
    return `<span class="avatar-letter">${escapeHtml(letter)}</span>`;
  }

  function getAllDueTodayTasks() {
    const list = [];
    if (!state?.houses) return list;
    for (const house of state.houses) {
      for (const room of house.rooms) {
        for (const task of room.tasks) {
          if (isTaskDueToday(task)) list.push(task);
        }
      }
    }
    return list;
  }

  function updateDailyLog() {
    const g = ensureGamification();
    const today = new Date().toDateString();
    const due = getAllDueTodayTasks();
    g.dailyLog[today] = {
      completed: due.filter((t) => t.completedToday).length,
      total: due.length,
      skipped: g.todaySkips || 0,
    };
  }

  function getLastCompletionDate() {
    let last = null;
    if (!state?.houses) return null;
    for (const house of state.houses) {
      for (const room of house.rooms) {
        for (const task of room.tasks) {
          if (task.lastCompleted && (!last || task.lastCompleted > last)) {
            last = task.lastCompleted;
          }
        }
      }
    }
    return last;
  }

  function applyReferralBonusToSubscription() {
    if (!currentUser?.referralBonusDays) return;
    state.subscription.bonusDays = (state.subscription.bonusDays || 0) + currentUser.referralBonusDays;
    currentUser.referralBonusDays = 0;
    upsertUser(currentUser);
    saveState();
  }

  function getRefFromUrl() {
    try {
      return new URLSearchParams(window.location.search).get("ref");
    } catch {
      return null;
    }
  }

  async function processReferralForNewUser(newUser) {
    const ref = getRefFromUrl();
    if (!ref || !newUser?.id) return;
    if (isSupabaseReady() && supabase) {
      const { data: referrer } = await supabase
        .from("profiles")
        .select("user_id, referrals_count, referral_bonus_days")
        .or(`referral_code.eq.${ref},user_id.eq.${ref}`)
        .neq("user_id", newUser.id)
        .maybeSingle();
      if (!referrer) return;
      newUser.referredBy = referrer.user_id;
      const { error } = await supabase
        .from("profiles")
        .update({
          referrals_count: (referrer.referrals_count || 0) + 1,
          referral_bonus_days: (referrer.referral_bonus_days || 0) + REFERRAL_BONUS_DAYS,
        })
        .eq("user_id", referrer.user_id);
      if (error) console.error("processReferral", error);
      return;
    }
    const users = loadUsers();
    const referrer = users.find((u) => u.id === ref || u.referralCode === ref);
    if (!referrer || referrer.id === newUser.id) return;
    newUser.referredBy = referrer.id;
    referrer.referralsCount = (referrer.referralsCount || 0) + 1;
    referrer.referralBonusDays = (referrer.referralBonusDays || 0) + REFERRAL_BONUS_DAYS;
    upsertUser(referrer);
  }

  function getReferralLink() {
    if (!currentUser) return REFERRAL_BASE_URL;
    return `${REFERRAL_BASE_URL}?ref=${encodeURIComponent(currentUser.id)}`;
  }

  async function shareProduct(productName) {
    const link = getReferralLink();
    try {
      await navigator.clipboard.writeText(link);
      toast(`Ссылка скопирована! (${productName})`);
    } catch {
      toast("Не удалось скопировать ссылку");
    }
  }

  function checkGamificationEvents() {
    if (!state) return;
    const g = ensureGamification();
    updateDailyLog();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toDateString();
    const yLog = g.dailyLog[yKey];
    if (yLog && yLog.total > 0) {
      if (yLog.completed === yLog.total && yLog.skipped === 0) {
        g.streakDays = (g.streakDays || 0) + 1;
      } else {
        g.streakDays = 0;
      }
    }

    if (g.streakDays >= 7 && !g.rewardsShown?.goldenStar) {
      g.rewardsShown = g.rewardsShown || {};
      g.rewardsShown.goldenStar = new Date().toISOString();
      addPoints(50, "Золотая звезда! +50 бонусных очков", "reward");
      g.streakDays = 0;
      ui.modal = { type: "gamificationReward", variant: "goldenStar", points: 50 };
      return;
    }

    const messyTask = findMessyTask();
    if (messyTask && !g.messyHouseShown) {
      g.messyHouseShown = true;
      addPoints(-20, "Штраф за запущенный дом", "penalty");
      ui.modal = { type: "gamificationReward", variant: "messyHouse", points: -20 };
      return;
    }

    const lastDone = getLastCompletionDate();
    const inactiveDays = lastDone ? daysBetween(lastDone) : daysBetween(state.lastVisitDate);
    const hasTasks = state.houses?.some((h) => h.rooms.some((r) => r.tasks.length));
    if (hasTasks && inactiveDays >= 30 && !g.rewardsShown?.inactive30) {
      g.rewardsShown = g.rewardsShown || {};
      g.rewardsShown.inactive30 = new Date().toISOString();
      addPoints(10, "Бонус за возвращение", "reward");
      ui.modal = { type: "gamificationReward", variant: "inactive30", points: 10 };
    }
  }

  function findMessyTask() {
    if (!state?.houses) return null;
    for (const house of state.houses) {
      for (const room of house.rooms) {
        for (const task of room.tasks) {
          if ((task.skipCount || 0) >= SKIP_WARN_AT) return task;
        }
      }
    }
    return null;
  }

  function setAvatarUpload(base64) {
    const g = ensureGamification();
    g.avatar = { type: "upload", value: base64 };
    if (currentUser) {
      currentUser.avatar = g.avatar;
      upsertUser(currentUser);
    }
    saveState();
    render();
    toast("Фото загружено");
  }

  function clearAvatar() {
    const g = ensureGamification();
    g.avatar = { type: "letter", value: "" };
    if (currentUser) {
      currentUser.avatar = g.avatar;
      upsertUser(currentUser);
    }
    saveState();
    render();
    toast("Аватар сброшен");
  }

  function readAvatarFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Выберите файл изображения"));
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error("Файл слишком большой (макс. 8 МБ)"));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Некорректное изображение"));
        img.onload = () => {
          const maxSide = 320;
          let w = img.width;
          let h = img.height;
          if (w > maxSide || h > maxSide) {
            if (w >= h) {
              h = Math.round((h * maxSide) / w);
              w = maxSide;
            } else {
              w = Math.round((w * maxSide) / h);
              h = maxSide;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleAvatarUpload(file) {
    try {
      const dataUrl = await readAvatarFile(file);
      setAvatarUpload(dataUrl);
    } catch (e) {
      console.error("avatar upload:", e);
      toast(e.message || "Не удалось загрузить фото");
    }
  }

  function setTone(toneId) {
    const g = ensureGamification();
    g.tone = toneId;
    saveState();
    render();
  }

  function getTodayProgress(house) {
    let total = 0;
    let done = 0;
    for (const room of house.rooms) {
      for (const task of room.tasks) {
        if (!isTaskDueToday(task)) continue;
        total++;
        if (task.completedToday) done++;
      }
    }
    return { done, total };
  }

  function triggerConfetti(taskId) {
    ui.confetti = true;
    ui.justCompletedId = taskId;
    setTimeout(() => {
      ui.confetti = false;
      ui.justCompletedId = null;
      const el = document.querySelector(".confetti-layer");
      if (el) el.remove();
    }, 1800);
  }

  // ——— Notifications ———
  function loadNotifSettings() {
    if (state?.notifSettings) return { ...state.notifSettings };
    return defaultNotifSettings();
  }

  function saveNotifSettings(settings) {
    if (!state) return;
    state.notifSettings = { ...settings };
    saveState();
  }

  function syncNotifPermission() {
    const settings = loadNotifSettings();
    if ("Notification" in window) {
      settings.permission = Notification.permission;
      saveNotifSettings(settings);
    }
    return settings;
  }

  function notificationsSupported() {
    return "Notification" in window;
  }

  function notificationsAllowed() {
    if (!notificationsSupported()) return false;
    const settings = syncNotifPermission();
    return settings.enabled && Notification.permission === "granted";
  }

  async function requestNotifPermission() {
    if (!notificationsSupported()) {
      toast("Браузер не поддерживает уведомления");
      return false;
    }
    const settings = loadNotifSettings();
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
      settings.permissionRequested = true;
    }
    settings.permission = perm;
    saveNotifSettings(settings);
    return perm === "granted";
  }

  function showBrowserNotification(title, body) {
    if (!notificationsAllowed()) return false;
    try {
      new Notification(title, { body, tag: "domashniy-plan" });
      return true;
    } catch {
      return false;
    }
  }

  function pluralTasks(n) {
    const abs = Math.abs(n) % 100;
    const d = abs % 10;
    if (abs > 10 && abs < 20) return "дел";
    if (d === 1) return "дело";
    if (d >= 2 && d <= 4) return "дела";
    return "дел";
  }

  function countIncompleteTasks() {
    if (!state?.houses) return 0;
    let count = 0;
    for (const house of state.houses) {
      for (const room of house.rooms) {
        for (const task of room.tasks) {
          if (!task.completedToday && isTaskDueToday(task)) count++;
        }
      }
    }
    return count;
  }

  function showDailySummaryIfNeeded() {
    if (!notificationsAllowed()) return;
    const count = countIncompleteTasks();
    if (count === 0) return;
    const today = new Date().toDateString();
    if (localStorage.getItem(NOTIF_DAILY_KEY) === today) return;
    localStorage.setItem(NOTIF_DAILY_KEY, today);
    showBrowserNotification(
      "🧹 Домашний план",
      `У вас ${count} ${pluralTasks(count)} на сегодня. Откройте приложение, чтобы увидеть список.`
    );
  }

  async function initNotificationsOnLoad() {
    if (!notificationsSupported()) return;
    const settings = loadNotifSettings();
    settings.permission = Notification.permission;

    if (Notification.permission === "default" && !settings.permissionRequested) {
      settings.permissionRequested = true;
      saveNotifSettings(settings);
      const perm = await Notification.requestPermission();
      settings.permission = perm;
      saveNotifSettings(settings);
    } else {
      saveNotifSettings(settings);
    }

    showDailySummaryIfNeeded();
  }

  async function remindTask(taskId) {
    if (!notificationsSupported()) {
      toast("Браузер не поддерживает уведомления");
      return;
    }

    let settings = loadNotifSettings();
    if (Notification.permission !== "granted") {
      const granted = await requestNotifPermission();
      if (!granted) {
        toast("Разрешите уведомления в браузере");
        render();
        return;
      }
      settings = loadNotifSettings();
    }

    if (!settings.enabled) {
      toast("Включите уведомления в профиле");
      return;
    }

    const found = findTask(taskId);
    if (!found) return;
    const { room, task } = found;
    const ok = showBrowserNotification(
      "🧹 Напоминание",
      `Напоминание: ${task.name} в комнате ${room.name}`
    );
    if (ok) toast(getMessage("remindSent"));
  }

  async function toggleNotificationsEnabled(enabled) {
    const settings = loadNotifSettings();
    settings.enabled = enabled;
    saveNotifSettings(settings);

    if (enabled && Notification.permission !== "granted") {
      const granted = await requestNotifPermission();
      if (!granted) {
        settings.enabled = false;
        saveNotifSettings(settings);
        toast("Разрешите уведомления в браузере");
      } else if (countIncompleteTasks() > 0) {
        showDailySummaryIfNeeded();
      }
    }
    render();
  }

  function notifPermissionLabel() {
    if (!notificationsSupported()) return "Не поддерживается";
    syncNotifPermission();
    const map = { granted: "Разрешены", denied: "Запрещены", default: "Не запрошены" };
    return map[Notification.permission] || Notification.permission;
  }

  function allProducts() {
    const list = [];
    for (const house of state.houses) {
      for (const room of house.rooms) {
        for (const task of room.tasks) {
          for (const p of task.products || []) {
            list.push({
              ...p,
              houseName: house.name,
              roomName: room.name,
              taskName: task.name,
            });
          }
        }
      }
    }
    return list;
  }

  function effectivePriority(task) {
    if (task.skipCount >= SKIP_RED_AT) return "red";
    return task.priority || "green";
  }

  function resetCompletedTodayIfNeeded() {
    const today = new Date().toDateString();
    const marked = localStorage.getItem(DAY_MARK_KEY);
    if (marked === today) return;
    for (const h of state.houses) {
      for (const r of h.rooms) {
        for (const t of r.tasks) t.completedToday = false;
      }
    }
    localStorage.setItem(DAY_MARK_KEY, today);
    if (isSupabaseReady() && supabase) {
      const tasks = [];
      for (const h of state.houses) {
        for (const r of h.rooms) {
          for (const t of r.tasks) tasks.push({ task: t, roomId: r.id });
        }
      }
      Promise.all(tasks.map(({ task, roomId }) => upsertTaskToDb(task, roomId))).catch(console.error);
    }
  }

  function showBootError(err) {
    console.error("Boot error:", err);
    const root = document.getElementById("app");
    if (!root) return;
    root.innerHTML = `
      <div class="screen" style="padding:24px">
        <h1 class="brand">Ошибка загрузки</h1>
        <p class="sub">${String(err?.message || err).replace(/</g, "&lt;")}</p>
        <p class="sub">Попробуйте обновить страницу (F5).</p>
      </div>
    `;
  }

  // ——— Auth ———
  async function enterAppAs(user, { isNewUser = false } = {}) {
    if (!user?.id) {
      ui.authError = "Не удалось определить пользователя";
      ui.authLoading = false;
      ui.modal = null;
      render();
      return;
    }

    try {
      if (!user.referralCode) {
        user.referralCode = user.id;
        user.referralsCount = user.referralsCount || 0;
        user.referralBonusDays = user.referralBonusDays || 0;
      }
      upsertUser(user);

      currentUser = user;
      saveSession({
        userId: user.id,
        email: user.email || "",
        name: user.name || "",
        provider: user.provider || "email",
      });

      ui.screen = "app";
      ui.authError = "";
      ui.authLoading = false;
      ui.modal = null;
      ui.tab = "homes";
      ui.view = "houses";
      ui.planView = "rooms";
      ui.activeRoomId = null;

      if (isNewUser) {
        state = createFreshState();
        markFirstLaunch();
      } else {
        migrateLegacyState(user.id);
        state = loadState(user.id) || createFreshState();
        if (!state.houses?.length) {
          state = createFreshState();
          markFirstLaunch();
          isNewUser = true;
        }
      }

      state = normalizeAppState(state);
      state.profile = {
        ...(state.profile || {}),
        name: user.name,
        email: user.email || "",
        provider: user.provider || "email",
      };
      state.lastVisitDate = new Date().toISOString();
      state.activeHouseId = state.activeHouseId || state.houses[0]?.id;
      ui.activeHouseId = state.activeHouseId;

      migrateState();
      applyReferralBonusToSubscription();
      saveState();

      if (isNewUser && isSupabaseReady() && supabase) {
        try {
          const {
            data: { user: authUser },
          } = await supabase.auth.getUser();
          if (authUser) await seedDefaultDataToDb(state);
        } catch (e) {
          console.warn("seedDefaultDataToDb:", e);
        }
      }

      continueBootAfterAuth();
    } catch (e) {
      console.error("enterAppAs failed:", e);
      // Даже при ошибке пост-логина оставляем сессию и показываем приложение с чистым состоянием
      currentUser = user;
      saveSession({
        userId: user.id,
        email: user.email || "",
        name: user.name || "",
        provider: user.provider || "email",
      });
      state = createFreshState();
      state.profile = {
        name: user.name,
        email: user.email || "",
        provider: user.provider || "email",
      };
      state.activeHouseId = state.houses[0].id;
      ui.activeHouseId = state.houses[0].id;
      ui.screen = "app";
      ui.authError = "";
      ui.authLoading = false;
      ui.modal = null;
      saveState();
      render();
      toast("Вход выполнен");
    }
  }

  async function logout() {
    if (isSupabaseReady() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn(e);
      }
    }
    saveSession(null);
    currentUser = null;
    state = null;
    ui.screen = "auth";
    ui.modal = null;
    ui.authError = "";
    ui.authLoading = false;
    ui.tab = "homes";
    ui.view = "houses";
    clearIntervals();
    render();
  }

  async function loginWithEmail(email, password) {
    const cleaned = String(email || "").trim().toLowerCase();
    const pass = String(password || "");

    if (!cleaned || !cleaned.includes("@")) {
      ui.authError = "Введите корректный email";
      ui.authLoading = false;
      render();
      return;
    }
    if (pass.length < 4) {
      ui.authError = "Пароль не менее 4 символов";
      ui.authLoading = false;
      render();
      return;
    }

    ui.authError = "";
    ui.authLoading = true;
    render();

    try {
      let user = getUserByEmail(cleaned);
      let isNewUser = false;

      if (user) {
        if (user.provider && user.provider !== "email") {
          throw new Error(
            `Этот email привязан к входу через ${PROVIDER_LABELS[user.provider] || user.provider}`
          );
        }
        if (user.password !== pass) {
          throw new Error("Неверный пароль");
        }
        user.provider = "email";
        user.email = cleaned;
        if (!user.name) user.name = cleaned.split("@")[0] || "Пользователь";
        upsertUser(user);
      } else {
        isNewUser = true;
        user = {
          id: uid(),
          email: cleaned,
          password: pass,
          name: cleaned.split("@")[0] || "Пользователь",
          provider: "email",
          createdAt: new Date().toISOString(),
          referralCode: null,
          referralsCount: 0,
          referralBonusDays: 0,
          referredBy: null,
        };
        user.referralCode = user.id;
        await processReferralForNewUser(user);
        upsertUser(user);
      }

      await enterAppAs(user, { isNewUser });
      toast(
        isNewUser
          ? getMessage("accountCreated")
          : getMessage("welcomeBack", { name: user.name })
      );
    } catch (e) {
      console.error("loginWithEmail:", e);
      ui.authLoading = false;
      ui.authError = e.message || "Ошибка входа";
      ui.screen = "auth";
      render();
    }
  }

  function startSocialLogin(provider) {
    if (!provider) return;
    ui.authError = "";
    ui.authLoading = false;
    ui.modal = { type: "socialName", provider };
    render();
  }

  async function completeSocialLogin(provider, name) {
    if (!provider) return;

    const displayName = String(name || "").trim();
    if (!displayName) {
      ui.authError = "Введите имя, чтобы войти";
      toast("Введите имя");
      render();
      document.getElementById("social-name-input")?.focus();
      return;
    }

    ui.authLoading = true;
    ui.authError = "";
    render();

    try {
      let user = findSocialUser(provider, displayName);
      let isNewUser = false;

      if (user) {
        user.name = displayName;
        user.provider = provider;
        user.email = user.email || socialAccountEmail(provider, displayName);
        upsertUser(user);
      } else {
        isNewUser = true;
        user = {
          id: uid(),
          email: socialAccountEmail(provider, displayName),
          password: null,
          name: displayName,
          provider,
          createdAt: new Date().toISOString(),
          referralCode: null,
          referralsCount: 0,
          referralBonusDays: 0,
          referredBy: null,
        };
        user.referralCode = user.id;
        await processReferralForNewUser(user);
        upsertUser(user);
      }

      await enterAppAs(user, { isNewUser });
      toast(
        isNewUser
          ? getMessage("accountCreated")
          : getMessage("welcomeBack", { name: user.name })
      );
    } catch (e) {
      console.error("completeSocialLogin:", e);
      ui.authLoading = false;
      ui.authError = e.message || "Не удалось войти";
      ui.modal = { type: "socialName", provider };
      ui.screen = "auth";
      render();
    }
  }

  // ——— Boot / retention ———
  function bootLocal() {
    const session = loadSession();
    if (!session?.userId) {
      ui.screen = "auth";
      render();
      return;
    }
    let user = getUserById(session.userId);
    if (!user) {
      // Восстанавливаем пользователя из сессии, если список users потерян
      if (session.email || session.name) {
        user = {
          id: session.userId,
          email: session.email || "",
          name: session.name || session.email?.split("@")[0] || "Пользователь",
          provider: session.provider || "email",
          password: null,
          referralCode: session.userId,
          referralsCount: 0,
          referralBonusDays: 0,
          referredBy: null,
        };
        upsertUser(user);
      } else {
        saveSession(null);
        ui.screen = "auth";
        render();
        return;
      }
    }
    currentUser = user;
    ui.screen = "app";
    migrateLegacyState(user.id);

    const existing = loadState(user.id);
    if (!existing) {
      state = createFreshState();
      state.profile = {
        name: user.name,
        email: user.email,
        provider: user.provider,
      };
      state.activeHouseId = state.houses[0].id;
      ui.activeHouseId = state.houses[0].id;
      markFirstLaunch();
      saveState();
      render();
      initNotificationsOnLoad();
      return;
    }

    state = normalizeAppState(existing);
    state.profile = {
      ...(state.profile || {}),
      name: user.name,
      email: user.email || "",
      provider: user.provider || "email",
    };
    ui.activeHouseId = state.activeHouseId || state.houses[0]?.id;
    continueBootAfterAuth();
  }

  async function bootWithSupabase() {
    // Вход всегда локальный; Supabase — только если уже есть облачная сессия
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const user = await mergeProfileIntoUser(mapAuthUser(session.user));
        upsertUser({
          id: user.id,
          email: user.email,
          password: null,
          name: user.name,
          provider: user.provider,
          createdAt: new Date().toISOString(),
          referralCode: user.referralCode,
          referralsCount: user.referralsCount,
          referralBonusDays: user.referralBonusDays,
          referredBy: user.referredBy,
        });
        await enterAppAs(user);
        return;
      }
    } catch (e) {
      console.warn("Supabase session failed:", e);
    }
    bootLocal();
  }

  function boot() {
    if (isSupabaseReady() && supabase) {
      bootWithSupabase().catch((e) => {
        console.warn(e);
        bootLocal();
      });
      return;
    }
    bootLocal();
  }

  function continueBootAfterAuth() {
    try {
      migrateState();
      if (!state?.lastVisitDate) {
        state.lastVisitDate = new Date().toISOString();
      }

      const days = inactivityDays();

      if (days >= CODE_RETENTION_DAYS) {
        hardWipeKeepFirstLaunch();
        state = createFreshState();
        if (currentUser) {
          state.profile = {
            name: currentUser.name,
            email: currentUser.email,
            provider: currentUser.provider,
          };
        }
        state.activeHouseId = state.houses[0].id;
        ui.activeHouseId = state.houses[0].id;
        ui.screen = "deleted";
        renderDeletedStub();
        return;
      }

      if (days > UI_RETENTION_DAYS && days < CODE_RETENTION_DAYS) {
        ui.modal = { type: "surprise" };
        render();
        return;
      }

      const daysLeftUI = Math.max(0, UI_RETENTION_DAYS - days);
      ui.sessionDaysUntilDeletion = daysLeftUI;
      const deadline = new Date(state.lastVisitDate);
      deadline.setHours(0, 0, 0, 0);
      deadline.setDate(deadline.getDate() + UI_RETENTION_DAYS);
      ui.sessionDeletionDeadline = deadline;

      handleDeletionReminders(daysLeftUI);
      touchVisit();
      refreshSubscriptionStatus();
      resetCompletedTodayIfNeeded();
      saveState();
      checkGamificationEvents();
      render();
      initNotificationsOnLoad();
    } catch (e) {
      console.error("continueBootAfterAuth:", e);
      if (!state) state = createFreshState();
      ui.screen = "app";
      render();
    }
  }

  function touchVisit() {
    state.lastVisitDate = new Date().toISOString();
  }

  function handleDeletionReminders(daysLeft) {
    if (daysLeft <= 1 && daysLeft >= 0) {
      ui.modal = { type: "criticalDeletion" };
      ui.deletionBannerLevel = "critical";
    } else if (daysLeft <= 3) {
      ui.deletionBannerLevel = "blink";
    } else if (daysLeft <= 7) {
      ui.deletionBannerLevel = "warn7";
    } else {
      ui.deletionBannerLevel = null;
    }
  }

  function clearSessionRetentionSnapshot() {
    ui.sessionDaysUntilDeletion = null;
    ui.sessionDeletionDeadline = null;
    ui.deletionBannerLevel = null;
  }

  function acceptSurprise() {
    touchVisit();
    state.deletionWarningShown = true;
    clearSessionRetentionSnapshot();
    ui.modal = null;
    refreshSubscriptionStatus();
    resetCompletedTodayIfNeeded();
    saveState();
    render();
    toast("Таймер обнулён — у вас снова 60 дней");
  }

  function startOver() {
    hardWipeKeepFirstLaunch();
    markFirstLaunch();
    state = createFreshState();
    if (currentUser) {
      state.profile = {
        name: currentUser.name,
        email: currentUser.email,
        provider: currentUser.provider,
      };
    }
    state.activeHouseId = state.houses[0].id;
    ui = {
      screen: currentUser ? "app" : "auth",
      tab: "homes",
      view: "houses",
      activeHouseId: state.houses[0].id,
      modal: null,
      toastTimer: null,
      stopwatch: { running: false, startedAt: 0, elapsed: 0, taskRef: null, tick: null },
      critTick: null,
      deletionBannerLevel: null,
      sessionDaysUntilDeletion: null,
      sessionDeletionDeadline: null,
      authError: "",
      authLoading: false,
    };
    if (!currentUser) {
      state = null;
      render();
      return;
    }
    saveState();
    render();
  }

  // ——— Actions ———
  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function addHouse(name) {
    if (state.houses.length >= maxHousesAllowed()) {
      toast("Купите Премиум");
      ui.modal = { type: "plans" };
      render();
      return;
    }
    const house = makeDefaultHouse(name.trim() || "Новый дом");
    state.houses.push(house);
    ui.tab = "schedule";
    ui.planView = "rooms";
    ui.activeRoomId = null;
    ui.activeHouseId = house.id;
    state.activeHouseId = house.id;
    saveState();
    render();
  }

  function canAddHouse() {
    return state.houses.length < maxHousesAllowed();
  }

  function purchasePlan(planType, billing) {
    if (!state || !state.houses) {
      state = createFreshState();
      state.houses = [makeDefaultHouse("Моя квартира")];
      state.activeHouseId = state.houses[0].id;
      ui.activeHouseId = state.houses[0].id;
    }
    if (currentUser) {
      state.profile = {
        name: currentUser.name,
        email: currentUser.email,
        provider: currentUser.provider,
      };
    }
    state.subscription.status = "active";
    state.subscription.planType = planType;
    state.subscription.billing = billing;
    touchVisit();
    clearSessionRetentionSnapshot();
    ui.modal = null;
    ui.screen = "app";
    saveState();
    render();
    toast(planType === "premium" ? "Премиум активирован" : "Стандарт активирован");
  }

  function toggleTaskDone(taskId) {
    const found = findTask(taskId);
    if (!found) return;
    const { task } = found;
    const wasDone = task.completedToday;
    task.completedToday = !task.completedToday;
    try {
      if (task.completedToday) {
        task.lastCompleted = new Date().toISOString();
        task.skipCount = 0;
        ensureGamification().messyHouseShown = false;
        recordActionStat(task.name);
        addPoints(POINTS_PER_TASK, `Выполнено: ${task.name}`, "reward");
        if (isFloorTaskName(task.name)) {
          const area = Number(task.floorArea);
          if (area > 0) {
            const g = ensureGamification();
            g.totalFloorAreaCleaned = (g.totalFloorAreaCleaned || 0) + area;
          }
        }
        updateDailyLog();
        triggerConfetti(taskId);
        toast(getMessage("taskDone"));
      } else if (wasDone) {
        ensureGamification().actionStats[task.name] = Math.max(
          0,
          (ensureGamification().actionStats[task.name] || 1) - 1
        );
        if (isFloorTaskName(task.name)) {
          const area = Number(task.floorArea);
          if (area > 0) {
            const g = ensureGamification();
            g.totalFloorAreaCleaned = Math.max(0, (g.totalFloorAreaCleaned || 0) - area);
          }
        }
        addPoints(-POINTS_PER_TASK, `Отмена: ${task.name}`, "penalty");
      }
    } catch (e) {
      console.error("toggleTaskDone", e);
    }
    saveState();
    upsertTaskToDb(task, found.room.id).catch(console.error);
    render();
  }

  function completeTask(taskId) {
    const found = findTask(taskId);
    if (!found) return;
    if (found.task.completedToday) return;
    toggleTaskDone(taskId);
  }

  function skipTask(taskId) {
    const found = findTask(taskId);
    if (!found) return;
    const { task } = found;
    task.skipCount = (task.skipCount || 0) + 1;
    const g = ensureGamification();
    g.todaySkips = (g.todaySkips || 0) + 1;
    updateDailyLog();
    if (task.skipCount >= SKIP_WARN_AT) {
      toast(getMessage("skipWarn"));
    } else if (task.skipCount >= SKIP_RED_AT) {
      toast(getMessage("skipRed"));
    }
    saveState();
    upsertTaskToDb(task, found.room.id).catch(console.error);
    render();
  }

  function setPriority(taskId, prio) {
    const found = findTask(taskId);
    if (!found) return;
    found.task.priority = prio;
    saveState();
    upsertTaskToDb(found.task, found.room.id).catch(console.error);
    render();
  }

  function addRoom(houseId, name, width = null, length = null) {
    const house = state.houses.find((h) => h.id === houseId);
    if (!house) return;
    const room = makeRoom(name.trim() || "Комната", [], width, length);
    house.rooms.push(room);
    saveState();
    upsertRoomToDb(room, houseId).catch(console.error);
    render();
  }

  function saveRoomDetails(roomId, data) {
    const found = findRoomById(roomId);
    if (!found) return false;
    const { room } = found;
    const name = String(data.name || "").trim();
    if (!name) {
      toast("Введите название комнаты");
      return false;
    }
    room.name = name;
    const w = data.width !== "" && data.width != null ? Number(data.width) : null;
    const l = data.length !== "" && data.length != null ? Number(data.length) : null;
    room.width = w && w > 0 ? w : null;
    room.length = l && l > 0 ? l : null;
    room.area = calcRoomArea(room.width, room.length);
    const houseId = findHouseIdForRoom(roomId);
    saveState();
    upsertRoomToDb(room, houseId).catch(console.error);
    ui.modal = null;
    render();
    toast("Комната сохранена");
    return true;
  }

  function saveTaskFromModal(roomId, data, taskId = null) {
    const found = findRoomById(roomId);
    if (!found) return false;
    const { room } = found;
    const name = data.name.trim();
    if (!name) {
      toast("Введите название задачи");
      return false;
    }
    const minutes = Math.max(1, Number(data.minutes) || 15);
    const period = data.period || { type: "daily" };

    let task;
    if (taskId) {
      task = room.tasks.find((t) => t.id === taskId);
      if (!task) return false;
      const nameChanged = task.name !== name;
      task.name = name;
      task.estimatedMinutes = minutes;
      task.period = period;
      task.location = isShelfTaskName(name) ? data.location || null : null;
      task.floorArea =
        isFloorTaskName(name) && data.floorArea != null && data.floorArea !== ""
          ? Math.max(0, Number(data.floorArea))
          : null;
      delete task.frequencyDays;
      const fresh = defaultRecommendations(name);
      if (nameChanged) {
        task.products = defaultProducts(name);
      }
      task.recommendations = {
        means: data.means || fresh.means,
        inventory: data.inventory || fresh.inventory,
        motions: data.technique || fresh.motions,
        image: data.imageUrl || "",
      };
    } else {
      task = makeTask(name, "green", minutes, period);
      task.location = isShelfTaskName(name) ? data.location || null : null;
      task.floorArea =
        isFloorTaskName(name) && data.floorArea != null && data.floorArea !== ""
          ? Math.max(0, Number(data.floorArea))
          : isFloorTaskName(name)
            ? room.area || null
            : null;
      task.recommendations = {
        ...defaultRecommendations(name),
        means: data.means || defaultRecommendations(name).means,
        inventory: data.inventory || defaultRecommendations(name).inventory,
        motions: data.technique || defaultRecommendations(name).motions,
        image: data.imageUrl || "",
      };
      room.tasks.push(task);
    }
    saveState();
    upsertTaskToDb(task, roomId).catch(console.error);
    ui.modal = null;
    render();
    toast(taskId ? "Задача обновлена" : "Задача добавлена");
    return true;
  }

  function renameHouse(houseId, newName) {
    const house = state.houses.find((h) => h.id === houseId);
    if (!house) return;
    const trimmed = String(newName || "").trim();
    if (!trimmed) {
      toast("Введите название дома");
      return;
    }
    house.name = trimmed;
    saveState();
    ui.modal = null;
    render();
    toast("Название дома обновлено");
  }

  function renameRoom(roomId, newName) {
    const found = findRoomById(roomId);
    if (!found) return;
    const trimmed = String(newName || "").trim();
    if (!trimmed) {
      toast("Введите название комнаты");
      return;
    }
    found.room.name = trimmed;
    saveState();
    ui.modal = null;
    render();
    toast("Название комнаты обновлено");
  }

  function deleteRoom(roomId) {
    const house = getActiveHouse();
    if (!house) return;
    const before = house.rooms.length;
    house.rooms = house.rooms.filter((r) => r.id !== roomId);
    if (house.rooms.length === before) return;
    if (ui.activeRoomId === roomId) {
      ui.activeRoomId = null;
      ui.planView = "rooms";
    }
    saveState();
    ui.modal = null;
    render();
    toast("Комната удалена");
  }

  function deleteTask(taskId) {
    for (const h of state.houses) {
      for (const room of h.rooms) {
        const idx = room.tasks.findIndex((t) => t.id === taskId);
        if (idx >= 0) {
          room.tasks.splice(idx, 1);
          saveState();
          ui.modal = null;
          render();
          toast("Задача удалена");
          return;
        }
      }
    }
  }

  function taskFormFieldsHtml(roomId, task = null) {
    const roomInfo = findRoomById(roomId);
    const room = roomInfo?.room;
    const roomName = room?.name || "";
    const actions = getRoomActions(roomName);
    const currentName = task?.name || "";
    const inList = actions.includes(currentName);
    const selectedAction = inList ? currentName : "__custom__";
    const period = normalizePeriod(task || {});
    const minutes = task?.estimatedMinutes ?? 15;
    const isDaily = period.type === "daily";
    const periodCount = period.type === "days" ? period.count || 1 : 1;
    const periodValue = period.type === "days" ? period.value || 1 : 1;
    const rec = task?.recommendations || defaultRecommendations(currentName);
    const showShelf = isShelfTaskName(currentName);
    const showFloor = isFloorTaskName(currentName);
    const roomArea = room?.area ?? calcRoomArea(room?.width, room?.length);
    const floorAreaVal =
      task?.floorArea != null ? task.floorArea : showFloor && roomArea ? roomArea : "";

    const actionOptions = actions
      .map(
        (a) =>
          `<option value="${escapeHtml(a)}" ${a === selectedAction ? "selected" : ""}>${escapeHtml(a)}</option>`
      )
      .join("");

    const locationOptions = SHELF_LOCATIONS.map(
      (loc) =>
        `<option value="${escapeHtml(loc)}" ${task?.location === loc ? "selected" : ""}>${escapeHtml(loc)}</option>`
    ).join("");

    return `
      <div class="field">
        <label for="task-action-select">Действие из списка</label>
        <select id="task-action-select" data-room-id="${escapeHtml(roomId)}">
          ${actionOptions}
          <option value="__custom__" ${selectedAction === "__custom__" ? "selected" : ""}>Ввести свои данные</option>
        </select>
      </div>
      <div class="field">
        <label for="task-name-input">Название задачи</label>
        <input type="text" id="task-name-input" value="${escapeHtml(currentName)}" maxlength="60" placeholder="Выберите из списка или введите своё" />
      </div>
      <div class="field task-extra-field ${showShelf ? "" : "hidden"}" id="task-location-wrap">
        <label for="task-location-select">Где находится?</label>
        <select id="task-location-select">
          <option value="">— выберите —</option>
          ${locationOptions}
        </select>
      </div>
      <div class="field task-extra-field ${showFloor ? "" : "hidden"}" id="task-floor-area-wrap">
        <label for="task-floor-area-input">Площадь (м²)</label>
        <input type="number" id="task-floor-area-input" min="0" step="0.01" value="${floorAreaVal !== "" && floorAreaVal != null ? floorAreaVal : ""}" placeholder="${roomArea ? `Из комнаты: ${roomArea}` : "Укажите площадь"}" />
        ${roomArea ? `<p class="field-hint">Площадь комнаты: ${roomArea} м²</p>` : `<p class="field-hint">Укажите размеры комнаты, чтобы подставить площадь автоматически</p>`}
      </div>
      <div class="field period-field">
        <span class="field-label">Периодичность</span>
        <label class="period-daily-check">
          <input type="checkbox" id="period-daily-check" ${isDaily ? "checked" : ""} />
          Каждый день
        </label>
        <div class="period-interval-row ${isDaily ? "hidden" : ""}" id="period-interval-wrap">
          <input type="number" id="period-count" min="1" max="99" value="${periodCount}" aria-label="Раз" />
          <span>раз</span>
          <input type="number" id="period-value" min="1" max="365" value="${periodValue}" aria-label="В дней" />
          <span>в дней</span>
        </div>
      </div>
      <div class="field">
        <label for="task-min-input">Минуты</label>
        <input type="number" id="task-min-input" value="${minutes}" min="1" max="480" />
      </div>
      <div class="task-rec-fields">
        <p class="section-title" style="margin-top:8px">Рекомендации</p>
        <div class="field">
          <label for="task-means-input">Средство</label>
          <input type="text" id="task-means-input" value="${escapeHtml(rec.means || "")}" />
        </div>
        <div class="field">
          <label for="task-inventory-input">Инвентарь</label>
          <input type="text" id="task-inventory-input" value="${escapeHtml(rec.inventory || "")}" />
        </div>
        <div class="field">
          <label for="task-technique-input">Пошаговая инструкция</label>
          <textarea id="task-technique-input" rows="3" placeholder="Опишите шаги выполнения">${escapeHtml(rec.motions || "")}</textarea>
        </div>
        <div class="field">
          <label for="task-image-input">Своя картинка (URL)</label>
          <input type="url" id="task-image-input" value="${escapeHtml(rec.image || "")}" placeholder="Оставьте пустым — подберём по названию" />
        </div>
      </div>
    `;
  }

  function updateTaskFormExtras() {
    const nameInput = document.getElementById("task-name-input");
    const name = nameInput?.value?.trim() || "";
    const shelfWrap = document.getElementById("task-location-wrap");
    const floorWrap = document.getElementById("task-floor-area-wrap");
    const floorInput = document.getElementById("task-floor-area-input");
    if (shelfWrap) shelfWrap.classList.toggle("hidden", !isShelfTaskName(name));
    if (floorWrap) floorWrap.classList.toggle("hidden", !isFloorTaskName(name));
    if (isFloorTaskName(name) && floorInput && !floorInput.value) {
      const roomId = document.getElementById("task-action-select")?.dataset?.roomId;
      const room = roomId ? findRoomById(roomId)?.room : null;
      const roomArea = room?.area ?? calcRoomArea(room?.width, room?.length);
      if (roomArea) floorInput.value = roomArea;
    }
  }

  function updatePeriodFieldsVisibility() {
    const daily = document.getElementById("period-daily-check")?.checked;
    const wrap = document.getElementById("period-interval-wrap");
    if (wrap) wrap.classList.toggle("hidden", !!daily);
    const countEl = document.getElementById("period-count");
    const valueEl = document.getElementById("period-value");
    if (countEl) countEl.disabled = !!daily;
    if (valueEl) valueEl.disabled = !!daily;
  }

  function bindTaskFormHandlers() {
    const select = document.getElementById("task-action-select");
    const nameInput = document.getElementById("task-name-input");
    if (select && nameInput) {
      select.onchange = () => {
        if (select.value === "__custom__") {
          nameInput.value = "";
          nameInput.focus();
        } else {
          nameInput.value = select.value;
          const fresh = defaultRecommendations(select.value);
          const means = document.getElementById("task-means-input");
          const inv = document.getElementById("task-inventory-input");
          const tech = document.getElementById("task-technique-input");
          if (means && !means.value) means.value = fresh.means || "";
          if (inv && !inv.value) inv.value = fresh.inventory || "";
          if (tech && !tech.value) tech.value = fresh.motions || "";
        }
        updateTaskFormExtras();
      };
      nameInput.oninput = () => {
        const val = nameInput.value.trim();
        const match = [...select.options].find((o) => o.value === val && o.value !== "__custom__");
        if (match) select.value = val;
        else select.value = "__custom__";
        updateTaskFormExtras();
      };
    }
    const dailyCheck = document.getElementById("period-daily-check");
    if (dailyCheck) dailyCheck.onchange = updatePeriodFieldsVisibility;
    updatePeriodFieldsVisibility();
    updateTaskFormExtras();
  }

  function readTaskFormData() {
    const name = String(document.getElementById("task-name-input")?.value || "").trim();
    const minutes = document.getElementById("task-min-input")?.value || 15;
    const daily = document.getElementById("period-daily-check")?.checked;
    let period;
    if (daily) {
      period = { type: "daily" };
    } else {
      period = {
        type: "days",
        count: Math.max(1, Number(document.getElementById("period-count")?.value) || 1),
        value: Math.max(1, Number(document.getElementById("period-value")?.value) || 1),
      };
    }
    const location = document.getElementById("task-location-select")?.value || null;
    const floorAreaRaw = document.getElementById("task-floor-area-input")?.value;
    const floorArea =
      floorAreaRaw !== "" && floorAreaRaw != null ? Number(floorAreaRaw) : null;
    const means = document.getElementById("task-means-input")?.value ?? "";
    const inventory = document.getElementById("task-inventory-input")?.value ?? "";
    const technique = document.getElementById("task-technique-input")?.value ?? "";
    const imageUrl = document.getElementById("task-image-input")?.value?.trim() ?? "";
    return { name, minutes, period, location, floorArea, means, inventory, technique, imageUrl };
  }

  // ——— Render helpers ———
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(sec) {
    const s = Math.floor(sec % 60);
    const m = Math.floor((sec / 60) % 60);
    const h = Math.floor(sec / 3600);
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function renderDeletedStub() {
    clearIntervals();
    ui.screen = "deleted";
    document.getElementById("app").classList.remove("auth-mode");
    document.getElementById("app").innerHTML = `
      <div class="stub">
        <div class="stub-icon">📭</div>
        <h1>К сожалению, ваши данные удалены за долгим отсутствием</h1>
        <p>Начните заново или оплатите подписку, чтобы получить доступ к функциям.</p>
        <button class="btn btn-primary" data-action="start-over">Начать заново</button>
        <button class="btn btn-ghost" data-action="open-plans-deleted">Оформить тариф</button>
      </div>
    `;
    bindGlobal();
  }

  function bannerHtml() {
    if (!state) return "";
    refreshSubscriptionStatus();
    const daysLeftDel = uiDaysUntilDeletion();
    const delLine = `<span class="del-line">Осталось ${daysLeftDel} дн. до удаления данных</span>`;

    if (ui.deletionBannerLevel === "blink") {
      return `<button type="button" class="sub-banner blink" data-action="open-plans">
        ⚠️ Данные удалятся через ${daysLeftDel} ${pluralDays(daysLeftDel)}! Оплатите подписку!
        ${delLine}
      </button>`;
    }
    if (ui.deletionBannerLevel === "warn7") {
      return `<button type="button" class="sub-banner expired" data-action="open-plans">
        ⚠️ Данные удалятся через ${daysLeftDel} ${pluralDays(daysLeftDel)} (через 60 дней неактивности). Оплатите подписку!
        ${delLine}
      </button>`;
    }

    const { status } = state.subscription;
    if (status === "trial") {
      const left = trialDaysLeft();
      return `<button type="button" class="sub-banner" data-action="open-plans">
        🔥 Пробный период 14 дней. Осталось ${left} ${pluralDays(left)}.
        ${delLine}
      </button>`;
    }
    if (status === "expired") {
      return `<button type="button" class="sub-banner expired" data-action="open-plans">
        🔒 Подписка истекла. Оформите тариф
        ${delLine}
      </button>`;
    }
    const planLabel = state.subscription.planType === "premium" ? "Премиум" : "Стандарт";
    return `<button type="button" class="sub-banner" data-action="open-plans">
      ✓ Тариф «${planLabel}» активен
      ${delLine}
    </button>`;
  }

  function pluralDays(n) {
    const abs = Math.abs(n) % 100;
    const d = abs % 10;
    if (abs > 10 && abs < 20) return "дней";
    if (d === 1) return "день";
    if (d >= 2 && d <= 4) return "дня";
    return "дней";
  }

  function navHtml() {
    return `
      <nav class="bottom-nav bottom-nav-4">
        <button type="button" class="nav-btn ${ui.tab === "homes" ? "active" : ""}" data-action="tab-homes">
          <span>🏠</span> Дома
        </button>
        <button type="button" class="nav-btn ${ui.tab === "schedule" ? "active" : ""}" data-action="tab-schedule">
          <span>📅</span> План
        </button>
        <button type="button" class="nav-btn ${ui.tab === "shop" ? "active" : ""}" data-action="tab-shop">
          <span>🛒</span> Магазин
        </button>
        <button type="button" class="nav-btn ${ui.tab === "profile" ? "active" : ""}" data-action="tab-profile">
          <span>👤</span> Профиль
        </button>
      </nav>
    `;
  }

  function authView() {
    const err = ui.authError
      ? `<p class="auth-error">${escapeHtml(ui.authError)}</p>`
      : "";
    const loading = ui.authLoading;
    const disabled = loading ? "disabled" : "";
    const submitLabel = loading ? "Входим…" : "Войти / Зарегистрироваться";
    return `
      <div class="auth-screen">
        <div class="auth-card">
          <p class="auth-brand">Домашний план</p>
          <h1 class="auth-welcome">Добро пожаловать!</h1>
          <p class="auth-lead">Войдите и держите уборку по всем домам под контролем.</p>

          <div class="social-row" role="group" aria-label="Вход через соцсети">
            <button type="button" class="social-btn social-google" data-action="social-start" data-provider="google" title="Google" aria-label="Войти через Google" ${disabled}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"/>
                <path fill="#34A853" d="M6.6 14.3l-.8.6-2.5 1.9C5 19.5 8.2 21.5 12 21.5c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.8 0-5.1-1.9-5.9-4.4z"/>
                <path fill="#4A90E2" d="M3.3 7.2C2.5 8.7 2 10.3 2 12s.5 3.3 1.3 4.8l3.3-2.5C6.2 13.4 6 12.7 6 12s.2-1.4.5-2L3.3 7.2z"/>
                <path fill="#FBBC05" d="M12 5.5c1.5 0 2.8.5 3.9 1.5l2.9-2.9C16.9 2.4 14.7 1.5 12 1.5 8.2 1.5 5 3.5 3.3 7.2L6.5 9.6C7.4 7.2 9.6 5.5 12 5.5z"/>
              </svg>
            </button>
            <button type="button" class="social-btn social-vk" data-action="social-start" data-provider="vk" title="VK" aria-label="Войти через VK" ${disabled}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="#fff" d="M12.8 17.5h-1.5c-3.4 0-5.4-2.3-5.5-6.2h1.7c.1 2.8 1.3 4 2.3 4.1V9.3h1.7v2.9c1-.01 2-.6 2.4-1.6.2-.5.3-1 .3-1.3h1.7c-.1.8-.4 1.7-.9 2.4-.4.6-.9 1.1-1.5 1.4 1.1.3 1.9 1.1 2.4 1.9.7 1.1 1.2 2.3 1.6 2.5h-1.9c-.3-.6-1-1.6-2.1-2.7-.2-.2-.5-.2-.8 0-1 .9-1.6 1.8-1.8 2.4l-.1.3z"/>
              </svg>
            </button>
            <button type="button" class="social-btn social-tg" data-action="social-start" data-provider="telegram" title="Telegram" aria-label="Войти через Telegram" ${disabled}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="#fff" d="M9.7 14.6l-.4 3.9c.5 0 .8-.2 1.1-.5l2.6-2.5 5.4 4c1 .5 1.7.3 2-.9l3.6-16.9c.3-1.5-.5-2.1-1.5-1.7L2.4 9.3c-1.4.6-1.4 1.3-.3 1.7l4.4 1.4 10.2-6.4c.5-.3.9-.1.5.2L9.7 14.6z"/>
              </svg>
            </button>
          </div>

          <div class="auth-divider"><span>или войдите по почте</span></div>

          <form class="auth-form" data-action="email-auth-form">
            <div class="field">
              <label for="auth-email">Email</label>
              <input id="auth-email" type="email" autocomplete="email" placeholder="you@mail.ru" required />
            </div>
            <div class="field">
              <label for="auth-password">Пароль</label>
              <input id="auth-password" type="password" autocomplete="current-password" placeholder="••••••••" required />
            </div>
            ${err}
            <button type="submit" class="btn btn-primary" ${disabled}>${submitLabel}</button>
          </form>
        </div>
      </div>
    `;
  }

  function profileView() {
    const user = currentUser || {
      name: state?.profile?.name || "Гость",
      email: state?.profile?.email || "",
      provider: state?.profile?.provider || "email",
      referralsCount: 0,
      referralBonusDays: 0,
    };
    const g = ensureGamification();
    const name = user.name || "Пользователь";
    const providerLabel = PROVIDER_LABELS[user.provider] || user.provider || "Почта";
    const accountLine = accountDisplay(user);
    const notifSettings = syncNotifPermission();
    const notifChecked = notifSettings.enabled ? "checked" : "";
    const level = getLevelInfo(g.points);
    const statsEntries = Object.entries(g.actionStats || {}).sort((a, b) => b[1] - a[1]);
    const totalFloor = g.totalFloorAreaCleaned || 0;
    const floorStatHtml =
      totalFloor > 0
        ? `<li class="floor-stat"><span>Вымыто полов</span><strong>${totalFloor} м²</strong></li>`
        : "";

    const statsHtml = statsEntries.length
      ? floorStatHtml +
        statsEntries
          .map(
            ([action, count]) =>
              `<li><span>${escapeHtml(action)}</span><strong>${count} раз</strong></li>`
          )
          .join("")
      : floorStatHtml ||
        `<li class="empty-stat">Пока нет выполненных дел — начните с одной задачи!</li>`;

    const historyHtml = (g.rewardHistory || [])
      .slice(0, 8)
      .map(
        (h) =>
          `<li class="history-${h.kind || "reward"}">
            <span>${escapeHtml(h.title)}</span>
            <strong>${h.points > 0 ? "+" : ""}${h.points}</strong>
          </li>`
      )
      .join("");

    const toneOptions = TONE_OPTIONS.map(
      (t) =>
        `<option value="${t.id}" ${g.tone === t.id ? "selected" : ""}>${escapeHtml(t.label)}</option>`
    ).join("");

    const hasPhoto = g.avatar?.type === "upload" && g.avatar?.value;
    const clearBtn = hasPhoto
      ? `<button type="button" class="btn btn-ghost btn-sm" data-action="clear-avatar">Убрать фото</button>`
      : "";

    const referralCount = user.referralsCount || 0;
    const bonusDays = (state.subscription.bonusDays || 0) + (user.referralBonusDays || 0);

    return `
      <div class="screen profile-screen">
        <h1 class="brand">Профиль</h1>
        <p class="sub">${escapeHtml(getMessage("welcomeBack", { name }).split("!")[0])}!</p>
        <div class="profile-card">
          <div class="avatar avatar-lg">${getAvatarHtml(user, g)}</div>
          <h2 class="profile-name">${escapeHtml(name)}</h2>
          <p class="profile-meta">${escapeHtml(accountLine)}</p>
          ${
            user.provider === "email"
              ? ""
              : `<p class="profile-meta">Способ входа: ${escapeHtml(providerLabel)}</p>`
          }

          <div class="avatar-picker">
            <p class="picker-label">Аватар</p>
            <div class="avatar-actions">
              <label class="btn btn-ghost btn-sm avatar-upload-btn">
                Загрузить фото
                <input id="avatar-file-input" type="file" accept="image/*" hidden />
              </label>
              ${clearBtn}
            </div>
          </div>

          <div class="level-block">
            <div class="level-head">
              <span class="level-name">${escapeHtml(level.name)}</span>
              <span class="level-pts">${level.points} / 1000 очков</span>
            </div>
            <div class="level-bar"><div class="level-fill" style="width:${level.progressPct}%"></div></div>
            <p class="level-next">${level.nextName ? `До «${escapeHtml(level.nextName)}»: ${level.nextMin} очков` : "Максимальный уровень!"}</p>
          </div>

          <div class="stats-block">
            <p class="picker-label">Статистика действий</p>
            <ul class="stats-list">${statsHtml}</ul>
          </div>

          <div class="referral-block">
            <p class="picker-label">Реферальная программа</p>
            <p class="profile-meta">Приглашено друзей: <strong>${referralCount}</strong></p>
            <p class="profile-meta">Бонусных дней подписки: <strong>+${bonusDays}</strong></p>
          </div>

          ${historyHtml ? `<div class="history-block"><p class="picker-label">История наград</p><ul class="history-list">${historyHtml}</ul></div>` : ""}

          <div class="field" style="margin-top:16px">
            <label for="tone-select">Тон общения</label>
            <select id="tone-select" data-action="tone-select">${toneOptions}</select>
          </div>

          <label class="notif-toggle">
            <input type="checkbox" data-action="toggle-notifications" ${notifChecked} />
            <span>Включить уведомления</span>
          </label>
          <p class="profile-meta notif-status">Статус: ${escapeHtml(notifPermissionLabel())}</p>
          <button type="button" class="btn btn-ghost" style="width:100%;margin-top:18px" data-action="logout">Выйти</button>
        </div>
      </div>
    `;
  }

  function housesView() {
    const cards = state.houses
      .map((h) => {
        const tasks = h.rooms.reduce((n, r) => n + r.tasks.filter(isTaskDueToday).length, 0);
        const done = h.rooms.reduce(
          (n, r) => n + r.tasks.filter((t) => isTaskDueToday(t) && t.completedToday).length,
          0
        );
        return `
          <button type="button" class="house-card" data-action="open-house" data-id="${h.id}">
            <div class="house-icon">🏠</div>
            <div>
              <h3>${escapeHtml(h.name)}</h3>
              <p class="house-meta">${h.rooms.length} комн. · ${done}/${tasks} задач сегодня</p>
            </div>
            <span class="house-arrow">›</span>
          </button>
        `;
      })
      .join("");

    return `
      <div class="screen">
        <h1 class="brand">Домашний план</h1>
        <p class="sub">Уборка по домам — приоритеты, таймер и магазин в одном месте.</p>
        <div class="house-grid">${cards || '<p class="empty">Пока нет домов</p>'}</div>
        <button type="button" class="btn btn-primary" data-action="prompt-add-house">+ Добавить дом</button>
      </div>
    `;
  }

  function planHouseTopBar(house) {
    const options = state.houses
      .map(
        (h) =>
          `<option value="${h.id}" ${h.id === house.id ? "selected" : ""}>${escapeHtml(h.name)}</option>`
      )
      .join("");
    return `
      <div class="top-bar">
        <select class="house-select" data-action="switch-house">${options}</select>
        <button type="button" class="edit-house-btn" data-action="prompt-edit-house" title="Редактировать название дома" aria-label="Редактировать дом">✏️</button>
      </div>
    `;
  }

  function planSubTabsHtml() {
    const v = ui.planView;
    const roomsActive = v === "rooms" || v === "room";
    return `
      <div class="plan-subtabs" role="tablist">
        <button type="button" class="plan-subtab ${roomsActive ? "active" : ""}" data-action="plan-sub-rooms" role="tab">Комнаты</button>
        <button type="button" class="plan-subtab ${v === "today" ? "active" : ""}" data-action="plan-sub-today" role="tab">Сегодня</button>
        <button type="button" class="plan-subtab ${v === "calendar" ? "active" : ""}" data-action="plan-sub-calendar" role="tab">Календарь</button>
      </div>
    `;
  }

  function renderTaskCard(task, room, context = "room") {
    const prio = effectivePriority(task);
    const skipChip =
      task.skipCount >= SKIP_WARN_AT
        ? `<span class="chip danger">пропусков: ${task.skipCount}</span>`
        : task.skipCount > 0
          ? `<span class="chip warn">пропусков: ${task.skipCount}</span>`
          : "";
    const timed =
      task.lastTimedSeconds != null
        ? `<span class="chip">⏱ ${formatTime(task.lastTimedSeconds)}</span>`
        : "";
    const dueToday = isTaskDueToday(task);
    const dueChip =
      context === "room" && dueToday ? `<span class="chip accent">сегодня</span>` : "";
    const freqChip = `<span class="chip">${escapeHtml(periodLabel(task))}</span>`;
    const rec = task.recommendations || {};
    const displayImage = getTaskDisplayImage(task);
    const locationChip = task.location
      ? `<span class="chip">📍 ${escapeHtml(task.location)}</span>`
      : "";
    const areaChip =
      task.floorArea != null && task.floorArea > 0
        ? `<span class="chip">${task.floorArea} м²</span>`
        : "";
    const instructionHtml = rec.motions
      ? `<p class="task-instruction"><strong>Пошаговая инструкция:</strong> ${escapeHtml(rec.motions)}</p>`
      : "";
    const products = (task.products || [])
      .map(
        (p) =>
          `<a class="product-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">
            ${escapeHtml(p.name)}
            <span class="product-price">${escapeHtml(p.price || "")}</span>
          </a>`
      )
      .join("");

    const doneClass = task.completedToday ? "done" : "";
    const justDone = ui.justCompletedId === task.id ? " just-completed" : "";

    return `
      <div class="task prio-${prio} ${doneClass}${justDone}" data-task="${task.id}">
        <div class="task-row">
          <div class="task-body">
            <p class="task-name">${escapeHtml(task.name)}</p>
            ${instructionHtml}
            <div class="task-meta">
              <span class="chip">~${task.estimatedMinutes} мин</span>
              ${freqChip}${dueChip}${locationChip}${areaChip}${skipChip}${timed}
              <div class="traffic" title="Приоритет">
                <button type="button" class="t-red ${task.priority === "red" ? "on" : ""}" data-action="set-prio" data-id="${task.id}" data-prio="red" title="Высокий"></button>
                <button type="button" class="t-yellow ${task.priority === "yellow" ? "on" : ""}" data-action="set-prio" data-id="${task.id}" data-prio="yellow" title="Средний"></button>
                <button type="button" class="t-green ${task.priority === "green" ? "on" : ""}" data-action="set-prio" data-id="${task.id}" data-prio="green" title="Низкий"></button>
              </div>
            </div>
            <div class="task-primary-actions">
              <button type="button" class="btn btn-done ${task.completedToday ? "is-done" : ""}" data-action="complete-task" data-id="${task.id}">
                ${task.completedToday ? "✓ Готово!" : "✓ Выполнено"}
              </button>
              <button type="button" class="btn btn-skip" data-action="skip" data-id="${task.id}">Пропустить</button>
            </div>
            <div class="task-actions">
              <button type="button" class="btn btn-sm" data-action="open-timer" data-id="${task.id}">Засечь время</button>
              <button type="button" class="btn btn-sm btn-remind" data-action="remind-task" data-id="${task.id}">🔔 Напомнить</button>
              <button type="button" class="btn btn-sm" data-action="toggle-rec" data-id="${task.id}">Рекомендации</button>
              <button type="button" class="btn btn-sm" data-action="prompt-edit-task" data-id="${task.id}" data-room="${room.id}">✏️ Изменить</button>
              <button type="button" class="btn btn-sm btn-delete" data-action="prompt-delete-task" data-id="${task.id}" data-name="${escapeHtml(task.name)}">🗑 Удалить</button>
            </div>
            <div class="rec-block ${task.showRec ? "open" : ""}">
              <div class="rec-grid">
                <div class="rec-item"><strong>Средство</strong>${escapeHtml(rec.means || "—")}</div>
                <div class="rec-item"><strong>Инвентарь</strong>${escapeHtml(rec.inventory || "—")}</div>
                <div class="rec-item"><strong>Пошаговая инструкция</strong>${escapeHtml(rec.motions || "—")}</div>
              </div>
              ${displayImage ? `<img class="rec-img" src="${escapeHtml(displayImage)}" alt="" loading="lazy" />` : ""}
              ${products ? `<div class="product-links">${products}</div>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function roomsListView(house) {
    const cards = house.rooms
      .map((room) => {
        const count = room.tasks.length;
        const todayCount = room.tasks.filter(isTaskDueToday).length;
        return `
          <button type="button" class="room-card" data-action="open-room" data-id="${room.id}">
            <div class="room-card-icon">${roomIcon(room.name)}</div>
            <div class="room-card-body">
              <h3>${escapeHtml(room.name)}</h3>
              <p class="house-meta">${count} ${pluralTasks(count)}${todayCount ? ` · ${todayCount} сегодня` : ""}${room.area ? ` · ${room.area} м²` : ""}</p>
            </div>
            <span class="house-arrow">›</span>
          </button>
        `;
      })
      .join("");

    return `
      <div class="room-grid">
        ${cards || '<p class="empty">Пока нет комнат — добавьте первую</p>'}
      </div>
      <button type="button" class="btn btn-primary" data-action="prompt-add-room">➕ Добавить комнату</button>
    `;
  }

  function roomDetailView(house, room) {
    const tasksHtml = room.tasks.length
      ? room.tasks.map((task) => renderTaskCard(task, room)).join("")
      : '<p class="empty" style="padding:20px">В этой комнате пока нет задач</p>';

    return `
      <div class="room-detail-head">
        <button type="button" class="back-btn" data-action="back-rooms" aria-label="Назад к комнатам">‹</button>
        <h2 class="room-detail-title">${escapeHtml(roomDisplayName(room.name))}</h2>
        <button type="button" class="edit-house-btn" data-action="prompt-edit-room" data-id="${room.id}" title="Редактировать название" aria-label="Редактировать комнату">✏️</button>
      </div>
      <div class="room-detail-actions">
        <button type="button" class="btn btn-accent-soft" data-action="prompt-add-task" data-room="${room.id}">➕ Добавить задачу</button>
        <button type="button" class="btn btn-ghost btn-delete" data-action="prompt-delete-room" data-id="${room.id}" data-name="${escapeHtml(room.name)}">🗑 Удалить комнату</button>
      </div>
      <div class="task-list">${tasksHtml}</div>
    `;
  }

  function todayPlanView(house) {
    const progress = getTodayProgress(house);
    const progressHtml =
      progress.total > 0
        ? `<p class="today-progress">Выполнено <strong>${progress.done}</strong> из <strong>${progress.total}</strong></p>`
        : "";

    const roomsHtml = house.rooms
      .map((room) => {
        const todayTasks = room.tasks.filter(isTaskDueToday);
        if (!todayTasks.length) return "";
        const tasksHtml = todayTasks.map((task) => renderTaskCard(task, room, "today")).join("");
        return `
          <section class="room">
            <div class="room-head">
              <h2>${escapeHtml(roomDisplayName(room.name))}</h2>
              <button type="button" class="btn btn-sm btn-accent-soft" data-action="open-room" data-id="${room.id}">В комнату</button>
            </div>
            <div class="task-list">${tasksHtml}</div>
          </section>
        `;
      })
      .filter(Boolean)
      .join("");

    const roomsBlock =
      roomsHtml ||
      '<p class="empty" style="padding:20px">На сегодня задач нет — отличная работа!</p>';

    return `
      <div class="today-block">
        <p class="section-title" style="margin-top:0">Что сделать за X минут?</p>
        ${progressHtml}
        <div class="time-pick-row">
          <label class="time-pick-label" for="custom-minutes-input">Минут</label>
          <input type="number" id="custom-minutes-input" class="time-pick-input" min="1" max="480" value="30" aria-label="Количество минут" />
          <button type="button" class="btn btn-primary time-pick-btn" data-action="suggest-custom-time">Подобрать</button>
        </div>
      </div>
      <div class="quick-actions">
        <button type="button" class="btn btn-accent-soft" data-action="daily-report">Отчёт за день</button>
      </div>
      ${roomsBlock}
      ${ui.confetti ? '<div class="confetti-layer" aria-hidden="true"></div>' : ""}
    `;
  }

  function planScreenView() {
    const house = getActiveHouse();
    if (!house) {
      return `
        <div class="screen">
          <h1 class="brand">План</h1>
          <p class="empty">Сначала выберите или создайте дом на вкладке «Дома».</p>
        </div>
      `;
    }

    let content = "";
    const showSubTabs = ui.planView !== "room";

    if (ui.planView === "room" && ui.activeRoomId) {
      const room = house.rooms.find((r) => r.id === ui.activeRoomId);
      if (room) {
        content = roomDetailView(house, room);
      } else {
        ui.planView = "rooms";
        ui.activeRoomId = null;
        content = roomsListView(house);
      }
    } else if (ui.planView === "today") {
      content = todayPlanView(house);
    } else if (ui.planView === "calendar") {
      content = calendarViewBody();
    } else {
      ui.planView = "rooms";
      content = roomsListView(house);
    }

    return `
      <div class="screen plan-screen">
        <h1 class="brand">План</h1>
        <p class="sub">${escapeHtml(house.name)} — комнаты, задачи на сегодня и календарь.</p>
        ${planHouseTopBar(house)}
        ${showSubTabs ? planSubTabsHtml() : ""}
        ${content}
      </div>
    `;
  }

  function houseView() {
    return planScreenView();
  }

  function renderPlanTaskItem(item, showDate = false) {
    const { house, room, task } = item;
    const prio = effectivePriority(task);
    const done = task.completedToday && isTaskDueToday(task);
    return `
      <div class="plan-task-item prio-${prio} ${done ? "done" : ""}">
        <div>
          <strong>${escapeHtml(task.name)}</strong>
          <p class="house-meta">${escapeHtml(house.name)} · ${escapeHtml(roomDisplayName(room.name))} · ${escapeHtml(periodLabel(task))}</p>
        </div>
        <div class="plan-task-actions">
          <button type="button" class="btn btn-sm btn-done" data-action="plan-complete-task" data-id="${task.id}">✓</button>
          <button type="button" class="btn btn-sm" data-action="plan-edit-task" data-id="${task.id}" data-room="${room.id}">✏️</button>
        </div>
      </div>
    `;
  }

  function calendarViewBody() {
    if (!ui.calendar) ui.calendar = { mode: "day", date: new Date().toISOString(), pickMonth: null };
    const cal = ui.calendar;
    const baseDate = new Date(cal.date);
    const mode = cal.mode || "day";
    const todayKey = dateKey(new Date());

    const tabs = ["day", "week", "month", "year"]
      .map((m) => {
        const labels = { day: "День", week: "Неделя", month: "Месяц", year: "Год" };
        return `<button type="button" class="cal-tab ${mode === m ? "active" : ""}" data-action="cal-mode" data-mode="${m}">${labels[m]}</button>`;
      })
      .join("");

    let body = "";

    if (mode === "day") {
      const d = startOfDay(baseDate);
      const tasks = getTasksForDate(d);
      const list = tasks.length
        ? tasks.map((t) => renderPlanTaskItem(t)).join("")
        : `<p class="empty">На ${formatDateRu(d)} задач нет</p>`;
      body = `
        <div class="cal-nav">
          <button type="button" class="back-btn" data-action="cal-prev">‹</button>
          <span class="cal-title">${escapeHtml(formatDateRu(d))}</span>
          <button type="button" class="back-btn" data-action="cal-next">›</button>
        </div>
        <input type="date" class="cal-date-input" data-action="cal-pick-date" value="${dateKey(d)}" />
        <div class="plan-task-list">${list}</div>
      `;
    } else if (mode === "week") {
      const start = startOfDay(baseDate);
      const dayOfWeek = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - dayOfWeek);
      const days = [];
      for (let i = 0; i < 7; i++) days.push(addDays(start, i));
      body = `
        <div class="cal-nav">
          <button type="button" class="back-btn" data-action="cal-prev">‹</button>
          <span class="cal-title">Неделя ${dateKey(days[0]).slice(5)} – ${dateKey(days[6]).slice(5)}</span>
          <button type="button" class="back-btn" data-action="cal-next">›</button>
        </div>
        ${days
          .map((d) => {
            const tasks = getTasksForDate(d);
            const isToday = dateKey(d) === todayKey;
            return `
              <section class="cal-week-day ${isToday ? "is-today" : ""}">
                <h3>${escapeHtml(formatDateRu(d))}</h3>
                <div class="plan-task-list">
                  ${tasks.length ? tasks.map((t) => renderPlanTaskItem(t)).join("") : '<p class="empty" style="padding:8px">—</p>'}
                </div>
              </section>
            `;
          })
          .join("")}
      `;
    } else if (mode === "month") {
      const y = baseDate.getFullYear();
      const m = baseDate.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      const startPad = (first.getDay() + 6) % 7;
      const cells = [];
      for (let i = 0; i < startPad; i++) cells.push(null);
      for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
      const selectedKey = cal.selectedDay || todayKey;
      const selectedTasks = getTasksForDate(parseDateKey(selectedKey));
      body = `
        <div class="cal-nav">
          <button type="button" class="back-btn" data-action="cal-prev">‹</button>
          <span class="cal-title">${MONTH_NAMES[m]} ${y}</span>
          <button type="button" class="back-btn" data-action="cal-next">›</button>
        </div>
        <div class="cal-grid-head">
          <span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span>
        </div>
        <div class="cal-grid">
          ${cells
            .map((d) => {
              if (!d) return `<span class="cal-cell empty"></span>`;
              const key = dateKey(d);
              const has = getTasksForDate(d).length > 0;
              const isToday = key === todayKey;
              const isSel = key === selectedKey;
              return `<button type="button" class="cal-cell ${has ? "has-tasks" : ""} ${isToday ? "is-today" : ""} ${isSel ? "selected" : ""}" data-action="cal-select-day" data-day="${key}">${d.getDate()}${has ? '<i class="cal-dot"></i>' : ""}</button>`;
            })
            .join("")}
        </div>
        <div class="cal-day-detail">
          <h3>${escapeHtml(formatDateRu(parseDateKey(selectedKey)))}</h3>
          <div class="plan-task-list">
            ${selectedTasks.length ? selectedTasks.map((t) => renderPlanTaskItem(t)).join("") : '<p class="empty">Нет задач</p>'}
          </div>
        </div>
      `;
    } else if (mode === "year") {
      const y = baseDate.getFullYear();
      body = `
        <div class="cal-nav">
          <button type="button" class="back-btn" data-action="cal-prev">‹</button>
          <span class="cal-title">${y}</span>
          <button type="button" class="back-btn" data-action="cal-next">›</button>
        </div>
        <div class="cal-year-grid">
          ${MONTH_NAMES.map((name, mi) => {
            const cnt = countTasksInMonth(y, mi);
            return `
              <button type="button" class="cal-year-month ${cnt ? "has-tasks" : ""}" data-action="cal-select-month" data-month="${mi}">
                <strong>${name}</strong>
                <span>${cnt ? `${cnt} задач` : "—"}</span>
              </button>
            `;
          }).join("")}
        </div>
      `;
    }

    return `
      <div class="calendar-embed">
        <p class="section-title">Календарь — все дома</p>
        <div class="cal-tabs">${tabs}</div>
        ${body}
      </div>
    `;
  }

  function calendarView() {
    return planScreenView();
  }

  function shopView() {
    const items = allProducts();
    const html = items.length
      ? items
          .map(
            (p) => `
          <div class="shop-item">
            <h3>${escapeHtml(p.name)}</h3>
            <p class="shop-from">${escapeHtml(p.houseName)} · ${escapeHtml(p.roomName)} · ${escapeHtml(p.taskName)}</p>
            <div class="shop-actions">
              <a class="product-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">
                Купить ${p.price ? `· ${escapeHtml(p.price)}` : ""}
                <span>→</span>
              </a>
              <button type="button" class="btn btn-sm btn-share" data-action="share-product" data-name="${escapeHtml(p.name)}">➤ Поделиться</button>
            </div>
          </div>
        `
          )
          .join("")
      : `<div class="empty">Пока нет товаров.<br/>Они появятся из рекомендаций к задачам.</div>`;

    return `
      <div class="screen">
        <h1 class="brand">Магазин</h1>
        <p class="sub">Все товары из задач всех домов — в одном списке.</p>
        <div class="shop-list">${html}</div>
      </div>
    `;
  }

  function modalHtml() {
    if (!ui.modal) return "";
    const { type } = ui.modal;

    if (type === "socialName") {
      const label = PROVIDER_LABELS[ui.modal.provider] || ui.modal.provider;
      const err = ui.authError
        ? `<p class="auth-error">${escapeHtml(ui.authError)}</p>`
        : "";
      return `
        <div class="overlay center">
          <div class="modal">
            <h2>Вход через ${escapeHtml(label)}</h2>
            <p class="modal-desc">Введите имя — оно будет показано в профиле. При повторном входе с тем же именем откроется ваш аккаунт.</p>
            <div class="field">
              <label for="social-name-input">Имя</label>
              <input id="social-name-input" type="text" placeholder="Например, Анна" maxlength="40" autocomplete="name" required />
            </div>
            ${err}
            <button type="button" class="btn btn-primary" data-action="social-confirm" ${ui.authLoading ? "disabled" : ""}>${ui.authLoading ? "Входим…" : "Войти"}</button>
            <button type="button" class="btn btn-ghost" style="width:100%;margin-top:8px" data-action="close-modal">Отмена</button>
          </div>
        </div>
      `;
    }

    if (type === "plans") {
      return `
        <div class="overlay" data-action="close-modal-bg">
          <div class="modal" role="dialog">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>Тарифы</h2>
            <p class="modal-desc">Выберите план и продолжайте планировать уборку без потери данных.</p>
            <div class="plans">
              <div class="plan">
                <h3>Стандарт</h3>
                <p class="limit">1 дом</p>
                <div class="plan-prices">
                  <button type="button" class="price-btn" data-action="buy" data-plan="standard" data-billing="month">
                    299 ₽<small>в месяц</small>
                  </button>
                  <button type="button" class="price-btn" data-action="buy" data-plan="standard" data-billing="year">
                    1990 ₽<small>в год</small>
                  </button>
                </div>
              </div>
              <div class="plan featured">
                <h3>Премиум</h3>
                <p class="limit">до 5 домов</p>
                <div class="plan-prices">
                  <button type="button" class="price-btn" data-action="buy" data-plan="premium" data-billing="month">
                    499 ₽<small>в месяц</small>
                  </button>
                  <button type="button" class="price-btn" data-action="buy" data-plan="premium" data-billing="year">
                    3490 ₽<small>в год</small>
                  </button>
                </div>
              </div>
            </div>
            <p class="fine-print">Данные хранятся 60 дней при неактивности. Оплатите тариф, чтобы сохранить историю навсегда.</p>
          </div>
        </div>
      `;
    }

    if (type === "surprise") {
      return `
        <div class="overlay center">
          <div class="modal">
            <div class="surprise-emoji">🎁</div>
            <h2>Приятный сюрприз!</h2>
            <p class="modal-desc">Мы сохранили ваши данные на 30 дней дольше, чем обещали. Продлите подписку сейчас, и мы обнулим таймер!</p>
            <button type="button" class="btn btn-primary" data-action="accept-surprise-pay">Продлить подписку</button>
            <button type="button" class="btn btn-ghost" style="width:100%;margin-top:8px" data-action="accept-surprise">Спасибо, обнулить таймер</button>
          </div>
        </div>
      `;
    }

    if (type === "criticalDeletion") {
      const hours = hoursUntil(uiDeletionDeadline());
      return `
        <div class="overlay fullscreen">
          <div class="crit-modal">
            <h1>Данные удалятся очень скоро</h1>
            <div class="crit-hours" data-crit-hours>${hours} ч</div>
            <p>До удаления по правилам интерфейса остался 1 день (60 дней неактивности). Оформите подписку, чтобы сохранить всё.</p>
            <button type="button" class="btn btn-primary" data-action="open-plans-from-crit">Оформить тариф</button>
            <button type="button" class="btn btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.3);margin-top:10px;width:min(280px,100%)" data-action="dismiss-crit">Продолжить</button>
          </div>
        </div>
      `;
    }

    if (type === "timer") {
      const t = ui.stopwatch;
      const display = formatTime(
        t.running ? t.elapsed + (Date.now() - t.startedAt) / 1000 : t.elapsed
      );
      return `
        <div class="overlay center" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-timer">×</button>
            <h2>Засечь время</h2>
            <p class="modal-desc">${escapeHtml(ui.modal.taskName || "")}</p>
            <div class="timer-display" data-timer-display>${display}</div>
            <div class="timer-controls">
              <button type="button" class="btn btn-primary" style="width:auto" data-action="timer-toggle">
                ${t.running ? "Пауза" : "Старт"}
              </button>
              <button type="button" class="btn btn-ghost" data-action="timer-reset">Сброс</button>
              <button type="button" class="btn btn-accent-soft" data-action="timer-save">Сохранить</button>
            </div>
          </div>
        </div>
      `;
    }

    if (type === "suggestTime") {
      const minutes = ui.modal.minutes || 30;
      const picks = ui.modal.tasks || [];
      const list = picks.length
        ? picks
            .map(
              (t) => `
            <div class="suggest-card">
              <h3>${escapeHtml(t.name)}</h3>
              <p class="house-meta">${escapeHtml(t.roomName)} · ~${t.estimatedMinutes} мин · приоритет ${t.prio}</p>
            </div>
          `
            )
            .join("")
        : `<p class="empty">Все задачи на сегодня закрыты — отличная работа!</p>`;
      return `
        <div class="overlay" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>За ${minutes} мин</h2>
            <p class="modal-desc">${escapeHtml(getMessage("taskSuggest", { minutes }))}</p>
            ${list}
          </div>
        </div>
      `;
    }

    if (type === "report") {
      const { done, total, skipped, items } = ui.modal;
      const list = items
        .map(
          (i) => `
          <li>
            <span class="mark">${i.done ? "✅" : "⬜"}</span>
            <span>${escapeHtml(i.name)} <small style="color:var(--ink-soft)">(${escapeHtml(i.room)})</small></span>
          </li>
        `
        )
        .join("");
      return `
        <div class="overlay" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>Отчёт за день</h2>
            <div class="report-stats">
              <div class="stat"><b>${done}</b><span>сделано</span></div>
              <div class="stat"><b>${total - done}</b><span>осталось</span></div>
              <div class="stat"><b>${skipped}</b><span>с пропусками</span></div>
            </div>
            <ul class="report-list">${list}</ul>
          </div>
        </div>
      `;
    }

    if (type === "addHouse") {
      return `
        <div class="overlay center" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>Новый дом</h2>
            <div class="field">
              <label>Название</label>
              <input type="text" id="house-name-input" placeholder="Дача, квартира родителей…" maxlength="40" />
            </div>
            <button type="button" class="btn btn-primary" data-action="confirm-add-house">Добавить</button>
          </div>
        </div>
      `;
    }

    if (type === "addRoom") {
      return `
        <div class="overlay center" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>Новая комната</h2>
            <div class="field">
              <label for="room-name-input">Название</label>
              <input type="text" id="room-name-input" placeholder="Спальня, коридор…" maxlength="40" />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="room-width-input">Ширина (м)</label>
                <input type="number" id="room-width-input" min="0" step="0.1" placeholder="4" />
              </div>
              <div class="field">
                <label for="room-length-input">Длина (м)</label>
                <input type="number" id="room-length-input" min="0" step="0.1" placeholder="5" />
              </div>
            </div>
            <button type="button" class="btn btn-primary" data-action="confirm-add-room">Добавить</button>
          </div>
        </div>
      `;
    }

    if (type === "editHouse") {
      const house = getActiveHouse();
      return `
        <div class="overlay center" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>Название дома</h2>
            <div class="field">
              <label for="edit-house-name-input">Новое название</label>
              <input type="text" id="edit-house-name-input" value="${escapeHtml(house?.name || "")}" maxlength="40" />
            </div>
            <button type="button" class="btn btn-primary" data-action="confirm-edit-house">Сохранить</button>
          </div>
        </div>
      `;
    }

    if (type === "editRoom") {
      const room = findRoomById(ui.modal.roomId)?.room;
      return `
        <div class="overlay center" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>Комната</h2>
            <div class="field">
              <label for="edit-room-name-input">Название</label>
              <input type="text" id="edit-room-name-input" value="${escapeHtml(room?.name || "")}" maxlength="40" />
            </div>
            <div class="field-row">
              <div class="field">
                <label for="edit-room-width-input">Ширина (м)</label>
                <input type="number" id="edit-room-width-input" min="0" step="0.1" value="${room?.width ?? ""}" placeholder="4" />
              </div>
              <div class="field">
                <label for="edit-room-length-input">Длина (м)</label>
                <input type="number" id="edit-room-length-input" min="0" step="0.1" value="${room?.length ?? ""}" placeholder="5" />
              </div>
            </div>
            ${room?.area ? `<p class="field-hint">Площадь: ${room.area} м²</p>` : ""}
            <button type="button" class="btn btn-primary" data-action="confirm-edit-room">Сохранить</button>
          </div>
        </div>
      `;
    }

    if (type === "taskForm") {
      const isEdit = ui.modal.mode === "edit";
      const task = isEdit ? findTask(ui.modal.taskId)?.task : null;
      return `
        <div class="overlay center" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>${isEdit ? "Редактировать задачу" : "Новая задача"}</h2>
            ${taskFormFieldsHtml(ui.modal.roomId, task)}
            <button type="button" class="btn btn-primary" data-action="confirm-task-form">${isEdit ? "Сохранить" : "Добавить"}</button>
          </div>
        </div>
      `;
    }

    if (type === "confirmDeleteRoom") {
      return `
        <div class="overlay center" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>Удалить комнату?</h2>
            <p class="modal-desc">Точно удалить комнату «${escapeHtml(ui.modal.name)}»? Все задачи внутри тоже будут удалены.</p>
            <button type="button" class="btn btn-danger" style="width:100%" data-action="confirm-delete-room">Да, удалить</button>
            <button type="button" class="btn btn-ghost" style="width:100%;margin-top:8px" data-action="close-modal">Отмена</button>
          </div>
        </div>
      `;
    }

    if (type === "confirmDeleteTask") {
      return `
        <div class="overlay center" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>Удалить задачу?</h2>
            <p class="modal-desc">Удалить задачу «${escapeHtml(ui.modal.name)}»?</p>
            <button type="button" class="btn btn-danger" style="width:100%" data-action="confirm-delete-task">Да, удалить</button>
            <button type="button" class="btn btn-ghost" style="width:100%;margin-top:8px" data-action="close-modal">Отмена</button>
          </div>
        </div>
      `;
    }

    if (type === "gamificationReward") {
      const { variant, points } = ui.modal;
      const icons = { goldenStar: "⭐", messyHouse: "💀", inactive30: "🧹" };
      const titles = {
        goldenStar: "Золотая звезда!",
        messyHouse: getMessage("messyHouse"),
        inactive30: getMessage("inactive30"),
      };
      const bodies = {
        goldenStar: getMessage("goldenStar") + ` +${points} бонусных очков`,
        messyHouse: `Штраф ${points} очков. Пора навести порядок!`,
        inactive30: `+${points} бонусных очков за возвращение!`,
      };
      return `
        <div class="overlay center">
          <div class="modal reward-modal">
            <div class="reward-icon">${icons[variant] || "🎉"}</div>
            <h2>${escapeHtml(titles[variant] || "Награда")}</h2>
            <p class="modal-desc">${escapeHtml(bodies[variant] || "")}</p>
            <button type="button" class="btn btn-primary" data-action="close-gamification-modal">Отлично!</button>
          </div>
        </div>
      `;
    }

    return "";
  }

  function clearIntervals() {
    if (ui.stopwatch.tick) {
      clearInterval(ui.stopwatch.tick);
      ui.stopwatch.tick = null;
    }
    if (ui.critTick) {
      clearInterval(ui.critTick);
      ui.critTick = null;
    }
  }

  function render() {
    const root = document.getElementById("app");

    if (ui.screen === "auth") {
      root.classList.add("auth-mode");
      root.innerHTML = authView() + modalHtml();
      bindGlobal();
      if (ui.modal?.type === "socialName") {
        document.getElementById("social-name-input")?.focus();
      } else {
        document.getElementById("auth-email")?.focus();
      }
      return;
    }

    if (ui.screen === "deleted" || !state) {
      root.classList.remove("auth-mode");
      return;
    }

    root.classList.remove("auth-mode");
    let main = "";
    if (ui.tab === "shop") {
      main = shopView();
    } else if (ui.tab === "profile") {
      main = profileView();
    } else if (ui.tab === "schedule") {
      main = planScreenView();
    } else {
      main = housesView();
    }

    root.innerHTML = main + bannerHtml() + navHtml() + modalHtml();
    bindGlobal();

    if (ui.modal?.type === "criticalDeletion") {
      if (ui.critTick) clearInterval(ui.critTick);
      ui.critTick = setInterval(() => {
        const el = document.querySelector("[data-crit-hours]");
        if (el) el.textContent = `${hoursUntil(uiDeletionDeadline())} ч`;
      }, 60000);
    }

    if (ui.modal?.type === "timer" && ui.stopwatch.running) {
      startTimerTick();
    }

    if (ui.modal?.type === "addHouse") {
      document.getElementById("house-name-input")?.focus();
    }
    if (ui.modal?.type === "editHouse") {
      document.getElementById("edit-house-name-input")?.focus();
    }
    if (ui.modal?.type === "editRoom") {
      document.getElementById("edit-room-name-input")?.focus();
    }
    if (ui.modal?.type === "addRoom") {
      document.getElementById("room-name-input")?.focus();
    }
    if (ui.modal?.type === "taskForm") {
      bindTaskFormHandlers();
      document.getElementById("task-action-select")?.focus();
    }
  }

  function startTimerTick() {
    if (ui.stopwatch.tick) clearInterval(ui.stopwatch.tick);
    ui.stopwatch.tick = setInterval(() => {
      const el = document.querySelector("[data-timer-display]");
      if (!el || !ui.stopwatch.running) return;
      const sec = ui.stopwatch.elapsed + (Date.now() - ui.stopwatch.startedAt) / 1000;
      el.textContent = formatTime(sec);
    }, 200);
  }

  function pickTasksForMinutes(minutes) {
    const house = getActiveHouse();
    if (!house) return [];
    const budgetTotal = Math.max(1, Number(minutes) || 30);
    const prioWeight = { red: 0, yellow: 1, green: 2 };
    const open = [];
    for (const room of house.rooms) {
      for (const task of room.tasks) {
        if (!isTaskDueToday(task)) continue;
        if (task.completedToday) continue;
        open.push({
          name: task.name,
          roomName: room.name,
          estimatedMinutes: task.estimatedMinutes || 15,
          prio: effectivePriority(task),
        });
      }
    }
    open.sort((a, b) => prioWeight[a.prio] - prioWeight[b.prio]);
    const picked = [];
    let budget = budgetTotal;
    for (const t of open) {
      if (t.estimatedMinutes <= budget) {
        picked.push(t);
        budget -= t.estimatedMinutes;
      }
      if (budget <= 0) break;
    }
    if (!picked.length && open.length) picked.push(open[0]);
    return picked;
  }

  function openSuggestModal(minutes) {
    const m = Math.max(1, Number(minutes) || 30);
    ui.modal = { type: "suggestTime", minutes: m, tasks: pickTasksForMinutes(m) };
    render();
  }

  function buildReport() {
    const house = getActiveHouse();
    const items = [];
    let done = 0;
    let skipped = 0;
    for (const room of house.rooms) {
      for (const task of room.tasks) {
        if (!isTaskDueToday(task)) continue;
        items.push({
          name: task.name,
          room: room.name,
          done: !!task.completedToday,
        });
        if (task.completedToday) done++;
        if (task.skipCount > 0) skipped++;
      }
    }
    return { done, total: items.length, skipped, items };
  }

  // ——— Events ———
  function bindGlobal() {
    const root = document.getElementById("app");
    root.onclick = onClick;
    const select = root.querySelector(".house-select");
    if (select) {
      select.onchange = (e) => {
        ui.activeHouseId = e.target.value;
        state.activeHouseId = e.target.value;
        saveState();
        render();
      };
    }
    const form = root.querySelector(".auth-form");
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        if (ui.authLoading) return;
        const email = document.getElementById("auth-email")?.value || "";
        const password = document.getElementById("auth-password")?.value || "";
        loginWithEmail(email, password);
      };
    }
    const customMinInput = root.querySelector("#custom-minutes-input");
    if (customMinInput) {
      customMinInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          openSuggestModal(customMinInput.value);
        }
      };
    }
    const notifToggle = root.querySelector('[data-action="toggle-notifications"]');
    if (notifToggle) {
      notifToggle.onchange = (e) => {
        toggleNotificationsEnabled(e.target.checked);
      };
    }
    const toneSelect = root.querySelector("#tone-select");
    if (toneSelect) {
      toneSelect.onchange = (e) => setTone(e.target.value);
    }
    const dateInput = root.querySelector(".cal-date-input");
    if (dateInput) {
      dateInput.onchange = (e) => {
        ui.calendar.date = parseDateKey(e.target.value).toISOString();
        render();
      };
    }
    const avatarInput = root.querySelector("#avatar-file-input");
    if (avatarInput) {
      avatarInput.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (file) handleAvatarUpload(file);
      };
    }
    const socialNameInput = root.querySelector("#social-name-input");
    if (socialNameInput) {
      socialNameInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (ui.authLoading) return;
          completeSocialLogin(ui.modal?.provider, socialNameInput.value);
        }
      };
    }
  }

  function onClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "close-modal-bg" && e.target !== btn) return;
    if (action === "email-auth-form") return;

    switch (action) {
      case "tab-homes":
        ui.tab = "homes";
        ui.view = "houses";
        render();
        break;
      case "tab-schedule":
        ui.tab = "schedule";
        if (ui.planView !== "room") ui.planView = ui.planView || "rooms";
        render();
        break;
      case "plan-sub-rooms":
        ui.planView = "rooms";
        ui.activeRoomId = null;
        render();
        break;
      case "plan-sub-today":
        ui.planView = "today";
        ui.activeRoomId = null;
        render();
        break;
      case "plan-sub-calendar":
        ui.planView = "calendar";
        ui.activeRoomId = null;
        render();
        break;
      case "open-room":
        ui.planView = "room";
        ui.activeRoomId = btn.dataset.id;
        render();
        break;
      case "back-rooms":
        ui.planView = "rooms";
        ui.activeRoomId = null;
        render();
        break;
      case "tab-plan":
        ui.tab = "schedule";
        ui.planView = "rooms";
        render();
        break;
      case "tab-shop":
        ui.tab = "shop";
        render();
        break;
      case "tab-profile":
        ui.tab = "profile";
        render();
        break;
      case "logout":
        logout();
        break;
      case "social-start":
        if (ui.authLoading) break;
        startSocialLogin(btn.dataset.provider);
        break;
      case "social-confirm": {
        if (ui.authLoading) break;
        const name = document.getElementById("social-name-input")?.value || "";
        completeSocialLogin(ui.modal?.provider, name);
        break;
      }
      case "social-skip":
        break;
      case "open-house":
        ui.tab = "schedule";
        ui.planView = "rooms";
        ui.activeRoomId = null;
        ui.view = "houses";
        ui.activeHouseId = btn.dataset.id;
        state.activeHouseId = btn.dataset.id;
        saveState();
        render();
        break;
      case "back-houses":
        ui.tab = "homes";
        ui.view = "houses";
        ui.planView = "rooms";
        ui.activeRoomId = null;
        render();
        break;
      case "prompt-add-house":
        if (!canAddHouse()) {
          toast("Купите Премиум");
          ui.modal = { type: "plans" };
          render();
          break;
        }
        ui.modal = { type: "addHouse" };
        render();
        break;
      case "confirm-add-house": {
        const name = document.getElementById("house-name-input")?.value || "";
        ui.modal = null;
        addHouse(name);
        break;
      }
      case "prompt-add-room":
        ui.modal = { type: "addRoom" };
        render();
        break;
      case "confirm-add-room": {
        const name = document.getElementById("room-name-input")?.value || "";
        const width = document.getElementById("room-width-input")?.value;
        const length = document.getElementById("room-length-input")?.value;
        ui.modal = null;
        addRoom(getActiveHouse().id, name, width, length);
        break;
      }
      case "prompt-add-task":
        ui.modal = { type: "taskForm", mode: "add", roomId: btn.dataset.room };
        render();
        break;
      case "prompt-edit-task":
        ui.modal = {
          type: "taskForm",
          mode: "edit",
          roomId: btn.dataset.room,
          taskId: btn.dataset.id,
        };
        render();
        break;
      case "confirm-task-form": {
        const data = readTaskFormData();
        const { roomId, mode, taskId } = ui.modal;
        if (!data.name) {
          toast("Введите название задачи");
          break;
        }
        saveTaskFromModal(roomId, data, mode === "edit" ? taskId : null);
        break;
      }
      case "prompt-edit-house":
        ui.modal = { type: "editHouse" };
        render();
        break;
      case "prompt-edit-room":
        ui.modal = { type: "editRoom", roomId: btn.dataset.id };
        render();
        break;
      case "confirm-edit-room": {
        const name = document.getElementById("edit-room-name-input")?.value || "";
        const width = document.getElementById("edit-room-width-input")?.value;
        const length = document.getElementById("edit-room-length-input")?.value;
        saveRoomDetails(ui.modal.roomId, { name, width, length });
        break;
      }
      case "confirm-edit-house": {
        const name = document.getElementById("edit-house-name-input")?.value || "";
        renameHouse(getActiveHouse()?.id, name);
        break;
      }
      case "suggest-time":
        openSuggestModal(btn.dataset.minutes);
        break;
      case "suggest-custom-time": {
        const val = document.getElementById("custom-minutes-input")?.value;
        if (!val || Number(val) < 1) {
          toast("Введите количество минут");
          break;
        }
        openSuggestModal(val);
        break;
      }
      case "toggle-done":
        toggleTaskDone(btn.dataset.id);
        break;
      case "complete-task":
        completeTask(btn.dataset.id);
        break;
      case "skip":
        skipTask(btn.dataset.id);
        break;
      case "clear-avatar":
        clearAvatar();
        break;
      case "share-product":
        shareProduct(btn.dataset.name || "товар");
        break;
      case "close-gamification-modal":
        ui.modal = null;
        render();
        break;
      case "remind-task":
        remindTask(btn.dataset.id);
        break;
      case "prompt-delete-room":
        ui.modal = {
          type: "confirmDeleteRoom",
          roomId: btn.dataset.id,
          name: btn.dataset.name || "",
        };
        render();
        break;
      case "confirm-delete-room":
        deleteRoom(ui.modal.roomId);
        break;
      case "prompt-delete-task":
        ui.modal = {
          type: "confirmDeleteTask",
          taskId: btn.dataset.id,
          name: btn.dataset.name || "",
        };
        render();
        break;
      case "confirm-delete-task":
        deleteTask(ui.modal.taskId);
        break;
      case "set-prio":
        setPriority(btn.dataset.id, btn.dataset.prio);
        break;
      case "toggle-rec": {
        const found = findTask(btn.dataset.id);
        if (found) {
          found.task.showRec = !found.task.showRec;
          saveState();
          render();
        }
        break;
      }
      case "open-timer": {
        const found = findTask(btn.dataset.id);
        if (!found) break;
        if (ui.stopwatch.tick) clearInterval(ui.stopwatch.tick);
        ui.stopwatch = {
          running: false,
          startedAt: 0,
          elapsed: 0,
          taskRef: found.task.id,
          tick: null,
        };
        ui.modal = { type: "timer", taskName: found.task.name };
        render();
        break;
      }
      case "timer-toggle":
        if (ui.stopwatch.running) {
          ui.stopwatch.elapsed += (Date.now() - ui.stopwatch.startedAt) / 1000;
          ui.stopwatch.running = false;
          if (ui.stopwatch.tick) clearInterval(ui.stopwatch.tick);
        } else {
          ui.stopwatch.running = true;
          ui.stopwatch.startedAt = Date.now();
          startTimerTick();
        }
        render();
        break;
      case "timer-reset":
        ui.stopwatch.running = false;
        ui.stopwatch.elapsed = 0;
        ui.stopwatch.startedAt = 0;
        if (ui.stopwatch.tick) clearInterval(ui.stopwatch.tick);
        render();
        break;
      case "timer-save": {
        let sec = ui.stopwatch.elapsed;
        if (ui.stopwatch.running) sec += (Date.now() - ui.stopwatch.startedAt) / 1000;
        const found = findTask(ui.stopwatch.taskRef);
        if (found) {
          found.task.lastTimedSeconds = Math.round(sec);
          found.task.estimatedMinutes = Math.max(1, Math.round(sec / 60));
        }
        ui.stopwatch.running = false;
        if (ui.stopwatch.tick) clearInterval(ui.stopwatch.tick);
        ui.modal = null;
        saveState();
        render();
        toast(getMessage("timerSaved"));
        break;
      }
      case "close-timer":
        ui.stopwatch.running = false;
        if (ui.stopwatch.tick) clearInterval(ui.stopwatch.tick);
        ui.modal = null;
        render();
        break;
      case "daily-report":
        ui.modal = { type: "report", ...buildReport() };
        render();
        break;
      case "open-plans":
      case "open-plans-from-crit":
        ui.modal = { type: "plans" };
        render();
        break;
      case "open-plans-deleted":
        if (!state) {
          state = createFreshState();
          state.subscription.status = "expired";
          ui.activeHouseId = state.houses[0].id;
          state.activeHouseId = state.houses[0].id;
          if (currentUser) {
            state.profile = {
              name: currentUser.name,
              email: currentUser.email,
              provider: currentUser.provider,
            };
          }
        }
        ui.screen = "app";
        ui.modal = { type: "plans" };
        render();
        break;
      case "close-modal":
      case "close-modal-bg":
        if (ui.modal?.type === "surprise") break;
        ui.modal = null;
        render();
        break;
      case "dismiss-crit":
        ui.modal = null;
        clearSessionRetentionSnapshot();
        saveState();
        render();
        break;
      case "accept-surprise":
        acceptSurprise();
        break;
      case "accept-surprise-pay":
        acceptSurprise();
        ui.modal = { type: "plans" };
        render();
        break;
      case "buy":
        purchasePlan(btn.dataset.plan, btn.dataset.billing);
        break;
      case "start-over":
        startOver();
        break;
      case "cal-mode":
        ui.calendar.mode = btn.dataset.mode;
        render();
        break;
      case "cal-prev": {
        const cal = ui.calendar;
        const d = new Date(cal.date);
        const step = { day: 1, week: 7, month: 0, year: 0 }[cal.mode] ?? 1;
        if (cal.mode === "month") d.setMonth(d.getMonth() - 1);
        else if (cal.mode === "year") d.setFullYear(d.getFullYear() - 1);
        else d.setDate(d.getDate() - step);
        cal.date = d.toISOString();
        render();
        break;
      }
      case "cal-next": {
        const cal = ui.calendar;
        const d = new Date(cal.date);
        const step = { day: 1, week: 7, month: 0, year: 0 }[cal.mode] ?? 1;
        if (cal.mode === "month") d.setMonth(d.getMonth() + 1);
        else if (cal.mode === "year") d.setFullYear(d.getFullYear() + 1);
        else d.setDate(d.getDate() + step);
        cal.date = d.toISOString();
        render();
        break;
      }
      case "cal-select-day":
        ui.calendar.selectedDay = btn.dataset.day;
        ui.calendar.date = parseDateKey(btn.dataset.day).toISOString();
        render();
        break;
      case "cal-select-month": {
        const cal = ui.calendar;
        const d = new Date(cal.date);
        d.setMonth(Number(btn.dataset.month));
        d.setDate(1);
        cal.date = d.toISOString();
        cal.mode = "month";
        render();
        break;
      }
      case "plan-complete-task":
        completeTask(btn.dataset.id);
        break;
      case "plan-edit-task": {
        const house = state.houses.find((h) =>
          h.rooms.some((r) => r.id === btn.dataset.room)
        );
        if (house) {
          ui.tab = "schedule";
          ui.planView = "room";
          ui.activeRoomId = btn.dataset.room;
          ui.activeHouseId = house.id;
          state.activeHouseId = house.id;
        }
        ui.modal = {
          type: "taskForm",
          mode: "edit",
          roomId: btn.dataset.room,
          taskId: btn.dataset.id,
        };
        saveState();
        render();
        break;
      }
      default:
        break;
    }
  }

  // Expose debug helpers for testing 60/90 day scenarios
  window.__cleanerDebug = {
    setLastVisitDaysAgo(days) {
      if (!state) return;
      const d = new Date();
      d.setDate(d.getDate() - days);
      state.lastVisitDate = d.toISOString();
      saveState();
      location.reload();
    },
    setTrialDaysAgo(days) {
      if (!state) return;
      const d = new Date();
      d.setDate(d.getDate() - days);
      state.subscription.trialStartDate = d.toISOString();
      saveState();
      location.reload();
    },
    state: () => state,
  };

  try {
    boot();
  } catch (e) {
    showBootError(e);
  }
})();
