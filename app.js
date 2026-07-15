(() => {
  "use strict";

  const STORAGE_KEY = "multiHouseCleaner_v1";
  const FIRST_LAUNCH_KEY = "multiHouseCleaner_firstLaunch";
  const USERS_KEY = "multiHouseCleaner_users";
  const SESSION_KEY = "multiHouseCleaner_session";

  const TRIAL_DAYS = 14;
  const UI_RETENTION_DAYS = 60;
  const CODE_RETENTION_DAYS = 90;
  const MAX_HOUSES_STANDARD = 1;
  const MAX_HOUSES_PREMIUM = 5;
  const SKIP_WARN_AT = 3;
  const SKIP_RED_AT = 2;

  const MS_DAY = 86400000;

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

  function defaultRecommendations(taskName) {
    const map = {
      "Помыть пол": {
        means: "Универсальное средство для пола или вода с уксусом",
        inventory: "Швабра, ведро, тряпка из микрофибры",
        motions: "От дальнего угла к выходу, восьмёрками, не заходя на мокрое",
        image:
          "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=200&fit=crop",
      },
      "Протереть пыль": {
        means: "Антистатический спрей или слегка влажная салфетка",
        inventory: "Микрофибра, стремянка при необходимости",
        motions: "Сверху вниз, не круговыми движениями — чтобы не размазать",
        image:
          "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=200&fit=crop",
      },
      "Вымыть раковину": {
        means: "Крем-чистящее для сантехники, сода",
        inventory: "Губка, старая зубная щётка для смесителя",
        motions: "Нанести — подождать 2–3 мин — круговыми движениями — сполоснуть",
        image:
          "https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5?w=400&h=200&fit=crop",
      },
    };
    return (
      map[taskName] || {
        means: "Подходящее чистящее средство по типу поверхности",
        inventory: "Тряпка, губка, перчатки",
        motions: "От чистого к грязному, сверху вниз",
        image:
          "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=400&h=200&fit=crop",
      }
    );
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

  function makeTask(name, priority = "green", minutes = 15) {
    return {
      id: uid(),
      name,
      priority,
      skipCount: 0,
      estimatedMinutes: minutes,
      lastCompleted: null,
      completedToday: false,
      lastTimedSeconds: null,
      recommendations: defaultRecommendations(name),
      products: defaultProducts(name),
      showRec: false,
    };
  }

  function makeRoom(name, tasks) {
    return { id: uid(), name, tasks };
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
    };
  }

  // ——— State ———
  let state = null;
  let currentUser = null;
  let ui = {
    screen: "auth", // auth | app | deleted
    tab: "plan",
    view: "houses",
    activeHouseId: null,
    modal: null,
    toastTimer: null,
    stopwatch: { running: false, startedAt: 0, elapsed: 0, taskRef: null, tick: null },
    critTick: null,
    authError: "",
  };

  const PROVIDER_LABELS = {
    google: "Google",
    vk: "VK",
    telegram: "Telegram",
    email: "Почта",
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveState() {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    return loadUsers().find((u) => u.email.toLowerCase() === key) || null;
  }

  function upsertUser(user) {
    const users = loadUsers();
    const i = users.findIndex((u) => u.id === user.id);
    if (i >= 0) users[i] = user;
    else users.push(user);
    saveUsers(users);
    return user;
  }

  function isFirstLaunchDone() {
    return localStorage.getItem(FIRST_LAUNCH_KEY) === "1";
  }

  function markFirstLaunch() {
    localStorage.setItem(FIRST_LAUNCH_KEY, "1");
  }

  function hardWipeKeepFirstLaunch() {
    const kept = localStorage.getItem(FIRST_LAUNCH_KEY);
    const users = localStorage.getItem(USERS_KEY);
    localStorage.clear();
    if (kept) localStorage.setItem(FIRST_LAUNCH_KEY, kept);
    if (users) localStorage.setItem(USERS_KEY, users);
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
    const used = daysBetween(state.subscription.trialStartDate);
    return Math.max(0, TRIAL_DAYS - used);
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
    const key = "multiHouseCleaner_dayMark";
    const marked = localStorage.getItem(key);
    if (marked === today) return;
    for (const h of state.houses) {
      for (const r of h.rooms) {
        for (const t of r.tasks) t.completedToday = false;
      }
    }
    localStorage.setItem(key, today);
  }

  // ——— Auth ———
  function enterAppAs(user) {
    currentUser = user;
    saveSession({ userId: user.id, email: user.email });
    ui.screen = "app";
    ui.authError = "";
    ui.modal = null;
    ui.tab = "plan";
    ui.view = "houses";

    let existing = loadState();
    if (!existing) {
      existing = createFreshState();
      markFirstLaunch();
    }
    state = existing;
    if (!state.profile) state.profile = {};
    state.profile.name = user.name;
    state.profile.email = user.email;
    state.profile.provider = user.provider;
    state.activeHouseId = state.activeHouseId || state.houses[0]?.id;
    ui.activeHouseId = state.activeHouseId;
    saveState();
    continueBootAfterAuth();
  }

  function logout() {
    saveSession(null);
    currentUser = null;
    state = null;
    ui.screen = "auth";
    ui.modal = null;
    ui.authError = "";
    ui.tab = "plan";
    ui.view = "houses";
    clearIntervals();
    render();
  }

  function loginWithEmail(email, password) {
    const cleaned = String(email || "").trim().toLowerCase();
    const pass = String(password || "");
    if (!cleaned || !cleaned.includes("@")) {
      ui.authError = "Введите корректный email";
      render();
      return;
    }
    if (pass.length < 4) {
      ui.authError = "Пароль не менее 4 символов";
      render();
      return;
    }

    let user = getUserByEmail(cleaned);
    if (user) {
      if (user.provider !== "email") {
        ui.authError = `Этот email привязан к входу через ${PROVIDER_LABELS[user.provider] || user.provider}`;
        render();
        return;
      }
      if (user.password !== pass) {
        ui.authError = "Неверный пароль";
        render();
        return;
      }
      enterAppAs(user);
      toast(`С возвращением, ${user.name}!`);
      return;
    }

    user = upsertUser({
      id: uid(),
      email: cleaned,
      password: pass,
      name: cleaned.split("@")[0] || "Пользователь",
      provider: "email",
      createdAt: new Date().toISOString(),
    });
    enterAppAs(user);
    toast("Аккаунт создан");
  }

  function completeSocialLogin(provider, name) {
    const displayName =
      (name && name.trim()) ||
      ({ google: "Google User", vk: "VK User", telegram: "Telegram User" }[provider] ||
        "Пользователь");
    const email = `user_${provider}_${Math.random().toString(36).slice(2, 8)}@temp.com`;
    const user = upsertUser({
      id: uid(),
      email,
      password: null,
      name: displayName,
      provider,
      createdAt: new Date().toISOString(),
    });
    enterAppAs(user);
    toast(`Вход через ${PROVIDER_LABELS[provider]}`);
  }

  // ——— Boot / retention ———
  function boot() {
    const session = loadSession();
    if (!session?.userId) {
      ui.screen = "auth";
      render();
      return;
    }
    const user = getUserById(session.userId);
    if (!user) {
      saveSession(null);
      ui.screen = "auth";
      render();
      return;
    }
    currentUser = user;
    ui.screen = "app";

    const existing = loadState();
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
      return;
    }

    state = existing;
    if (!state.profile) {
      state.profile = {
        name: user.name,
        email: user.email,
        provider: user.provider,
      };
    }
    ui.activeHouseId = state.activeHouseId || state.houses[0]?.id;
    continueBootAfterAuth();
  }

  function continueBootAfterAuth() {
    const days = inactivityDays();

    if (days >= CODE_RETENTION_DAYS) {
      hardWipeKeepFirstLaunch();
      state = null;
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
    render();
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
      tab: "plan",
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
    ui.view = "house";
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
    task.completedToday = !task.completedToday;
    if (task.completedToday) {
      task.lastCompleted = new Date().toISOString();
      task.skipCount = 0;
    }
    saveState();
    render();
  }

  function skipTask(taskId) {
    const found = findTask(taskId);
    if (!found) return;
    const { task } = found;
    task.skipCount = (task.skipCount || 0) + 1;
    if (task.skipCount >= SKIP_WARN_AT) {
      toast("Внимание: задача пропущена уже 3 раза! Пора сделать.");
    } else if (task.skipCount >= SKIP_RED_AT) {
      toast("Задача краснеет — слишком много пропусков");
    }
    saveState();
    render();
  }

  function setPriority(taskId, prio) {
    const found = findTask(taskId);
    if (!found) return;
    found.task.priority = prio;
    saveState();
    render();
  }

  function addRoom(houseId, name) {
    const house = state.houses.find((h) => h.id === houseId);
    if (!house) return;
    house.rooms.push(makeRoom(name.trim() || "Комната", []));
    saveState();
    render();
  }

  function addTask(roomId, name, minutes) {
    for (const h of state.houses) {
      const room = h.rooms.find((r) => r.id === roomId);
      if (room) {
        room.tasks.push(makeTask(name.trim() || "Задача", "green", minutes || 15));
        saveState();
        render();
        return;
      }
    }
  }

  function deleteRoom(roomId) {
    const house = getActiveHouse();
    if (!house) return;
    const before = house.rooms.length;
    house.rooms = house.rooms.filter((r) => r.id !== roomId);
    if (house.rooms.length === before) return;
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
      <nav class="bottom-nav">
        <button type="button" class="nav-btn ${ui.tab === "plan" ? "active" : ""}" data-action="tab-plan">
          <span>📋</span> План
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
    return `
      <div class="auth-screen">
        <div class="auth-card">
          <p class="auth-brand">Домашний план</p>
          <h1 class="auth-welcome">Добро пожаловать!</h1>
          <p class="auth-lead">Войдите и держите уборку по всем домам под контролем.</p>

          <div class="social-row" role="group" aria-label="Вход через соцсети">
            <button type="button" class="social-btn social-google" data-action="social-start" data-provider="google" title="Google" aria-label="Войти через Google">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"/>
                <path fill="#34A853" d="M6.6 14.3l-.8.6-2.5 1.9C5 19.5 8.2 21.5 12 21.5c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.8 0-5.1-1.9-5.9-4.4z"/>
                <path fill="#4A90E2" d="M3.3 7.2C2.5 8.7 2 10.3 2 12s.5 3.3 1.3 4.8l3.3-2.5C6.2 13.4 6 12.7 6 12s.2-1.4.5-2L3.3 7.2z"/>
                <path fill="#FBBC05" d="M12 5.5c1.5 0 2.8.5 3.9 1.5l2.9-2.9C16.9 2.4 14.7 1.5 12 1.5 8.2 1.5 5 3.5 3.3 7.2L6.5 9.6C7.4 7.2 9.6 5.5 12 5.5z"/>
              </svg>
            </button>
            <button type="button" class="social-btn social-vk" data-action="social-start" data-provider="vk" title="VK" aria-label="Войти через VK">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="#fff" d="M12.8 17.5h-1.5c-3.4 0-5.4-2.3-5.5-6.2h1.7c.1 2.8 1.3 4 2.3 4.1V9.3h1.7v2.9c1-.01 2-.6 2.4-1.6.2-.5.3-1 .3-1.3h1.7c-.1.8-.4 1.7-.9 2.4-.4.6-.9 1.1-1.5 1.4 1.1.3 1.9 1.1 2.4 1.9.7 1.1 1.2 2.3 1.6 2.5h-1.9c-.3-.6-1-1.6-2.1-2.7-.2-.2-.5-.2-.8 0-1 .9-1.6 1.8-1.8 2.4l-.1.3z"/>
              </svg>
            </button>
            <button type="button" class="social-btn social-tg" data-action="social-start" data-provider="telegram" title="Telegram" aria-label="Войти через Telegram">
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
            <button type="submit" class="btn btn-primary" data-action="email-auth">Войти / Зарегистрироваться</button>
          </form>
        </div>
      </div>
    `;
  }

  function profileView() {
    const user = currentUser || {
      name: state?.profile?.name || "Гость",
      email: state?.profile?.email || "—",
      provider: state?.profile?.provider || "email",
    };
    const name = user.name || "Пользователь";
    const letter = name.trim().charAt(0).toUpperCase() || "?";
    const providerLabel = PROVIDER_LABELS[user.provider] || user.provider || "Почта";

    return `
      <div class="screen profile-screen">
        <h1 class="brand">Профиль</h1>
        <p class="sub">Личный кабинет и выход из аккаунта.</p>
        <div class="profile-card">
          <div class="avatar" aria-hidden="true">${escapeHtml(letter)}</div>
          <h2 class="profile-name">${escapeHtml(name)}</h2>
          <p class="profile-meta">Аккаунт: ${escapeHtml(user.email || "—")}</p>
          <p class="profile-meta">Провайдер: ${escapeHtml(providerLabel)}</p>
          <button type="button" class="btn btn-ghost" style="width:100%;margin-top:18px" data-action="logout">Выйти</button>
        </div>
      </div>
    `;
  }

  function housesView() {
    const cards = state.houses
      .map((h) => {
        const tasks = h.rooms.reduce((n, r) => n + r.tasks.length, 0);
        const done = h.rooms.reduce(
          (n, r) => n + r.tasks.filter((t) => t.completedToday).length,
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

  function houseView() {
    const house = getActiveHouse();
    if (!house) return housesView();

    const options = state.houses
      .map(
        (h) =>
          `<option value="${h.id}" ${h.id === house.id ? "selected" : ""}>${escapeHtml(h.name)}</option>`
      )
      .join("");

    const roomsHtml = house.rooms
      .map((room) => {
        const tasksHtml = room.tasks
          .map((task) => {
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
            const rec = task.recommendations || {};
            const products = (task.products || [])
              .map(
                (p) =>
                  `<a class="product-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">
                    ${escapeHtml(p.name)}
                    <span class="product-price">${escapeHtml(p.price || "")}</span>
                  </a>`
              )
              .join("");

            return `
              <div class="task prio-${prio} ${task.completedToday ? "done" : ""}" data-task="${task.id}">
                <div class="task-row">
                  <input type="checkbox" class="task-check" data-action="toggle-done" data-id="${task.id}"
                    ${task.completedToday ? "checked" : ""} />
                  <div class="task-body">
                    <p class="task-name">${escapeHtml(task.name)}</p>
                    <div class="task-meta">
                      <span class="chip">~${task.estimatedMinutes} мин</span>
                      ${skipChip}${timed}
                      <div class="traffic" title="Приоритет">
                        <button type="button" class="t-red ${task.priority === "red" ? "on" : ""}" data-action="set-prio" data-id="${task.id}" data-prio="red" title="Высокий"></button>
                        <button type="button" class="t-yellow ${task.priority === "yellow" ? "on" : ""}" data-action="set-prio" data-id="${task.id}" data-prio="yellow" title="Средний"></button>
                        <button type="button" class="t-green ${task.priority === "green" ? "on" : ""}" data-action="set-prio" data-id="${task.id}" data-prio="green" title="Низкий"></button>
                      </div>
                    </div>
                    <div class="task-actions">
                      <button type="button" class="btn btn-sm" data-action="skip" data-id="${task.id}">Пропустить</button>
                      <button type="button" class="btn btn-sm" data-action="open-timer" data-id="${task.id}">Засечь время</button>
                      <button type="button" class="btn btn-sm" data-action="toggle-rec" data-id="${task.id}">Рекомендации</button>
                      <button type="button" class="btn btn-sm btn-delete" data-action="prompt-delete-task" data-id="${task.id}" data-name="${escapeHtml(task.name)}">🗑 Удалить задачу</button>
                    </div>
                    <div class="rec-block ${task.showRec ? "open" : ""}">
                      <div class="rec-grid">
                        <div class="rec-item"><strong>Средство</strong>${escapeHtml(rec.means || "—")}</div>
                        <div class="rec-item"><strong>Инвентарь</strong>${escapeHtml(rec.inventory || "—")}</div>
                        <div class="rec-item"><strong>Движения</strong>${escapeHtml(rec.motions || "—")}</div>
                      </div>
                      ${rec.image ? `<img class="rec-img" src="${escapeHtml(rec.image)}" alt="" loading="lazy" />` : ""}
                      ${products ? `<div class="product-links">${products}</div>` : ""}
                    </div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <section class="room">
            <div class="room-head">
              <h2>${escapeHtml(room.name)}</h2>
              <div class="room-head-actions">
                <button type="button" class="btn btn-sm btn-accent-soft" data-action="prompt-add-task" data-room="${room.id}">+ Задача</button>
                <button type="button" class="btn btn-sm btn-delete" data-action="prompt-delete-room" data-id="${room.id}" data-name="${escapeHtml(room.name)}">🗑 Удалить комнату</button>
              </div>
            </div>
            <div class="task-list">${tasksHtml || '<p class="empty" style="padding:12px">Нет задач</p>'}</div>
          </section>
        `;
      })
      .join("");

    return `
      <div class="screen">
        <div class="top-bar">
          <button type="button" class="back-btn" data-action="back-houses" aria-label="Назад">‹</button>
          <select class="house-select" data-action="switch-house">${options}</select>
        </div>
        <div class="quick-actions">
          <button type="button" class="btn btn-accent-soft" data-action="suggest-30">Что сделать за 30 минут?</button>
          <button type="button" class="btn btn-accent-soft" data-action="daily-report">Отчёт за день</button>
        </div>
        ${roomsHtml}
        <button type="button" class="btn btn-ghost add-room-row" data-action="prompt-add-room" style="width:100%">+ Добавить комнату</button>
      </div>
    `;
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
            <a class="product-link" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">
              Купить ${p.price ? `· ${escapeHtml(p.price)}` : ""}
              <span>→</span>
            </a>
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
      return `
        <div class="overlay center">
          <div class="modal">
            <h2>Вход через ${escapeHtml(label)}</h2>
            <p class="modal-desc">Вы входите через ${escapeHtml(label)}. Введите ваше имя, чтобы мы знали, как к вам обращаться</p>
            <div class="field">
              <label for="social-name-input">Имя</label>
              <input id="social-name-input" type="text" placeholder="Как к вам обращаться?" maxlength="40" autocomplete="name" />
            </div>
            <button type="button" class="btn btn-primary" data-action="social-confirm">Продолжить</button>
            <button type="button" class="btn btn-ghost" style="width:100%;margin-top:8px" data-action="social-skip">Пропустить</button>
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

    if (type === "suggest30") {
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
            <h2>За 30 минут</h2>
            <p class="modal-desc">Подборка незавершённых задач с высоким приоритетом, чтобы уложиться в полчаса.</p>
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
              <label>Название</label>
              <input type="text" id="room-name-input" placeholder="Спальня, коридор…" maxlength="40" />
            </div>
            <button type="button" class="btn btn-primary" data-action="confirm-add-room">Добавить</button>
          </div>
        </div>
      `;
    }

    if (type === "addTask") {
      return `
        <div class="overlay center" data-action="close-modal-bg">
          <div class="modal">
            <button type="button" class="modal-close" data-action="close-modal">×</button>
            <h2>Новая задача</h2>
            <div class="field">
              <label>Название</label>
              <input type="text" id="task-name-input" placeholder="Погладить бельё…" maxlength="60" />
            </div>
            <div class="field">
              <label>Минуты</label>
              <input type="number" id="task-min-input" value="15" min="1" max="180" />
            </div>
            <button type="button" class="btn btn-primary" data-action="confirm-add-task">Добавить</button>
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
    } else if (ui.view === "house") {
      main = houseView();
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
    if (ui.modal?.type === "socialName") {
      document.getElementById("social-name-input")?.focus();
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

  function pick30MinTasks() {
    const house = getActiveHouse();
    if (!house) return [];
    const prioWeight = { red: 0, yellow: 1, green: 2 };
    const open = [];
    for (const room of house.rooms) {
      for (const task of room.tasks) {
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
    let budget = 30;
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

  function buildReport() {
    const house = getActiveHouse();
    const items = [];
    let done = 0;
    let skipped = 0;
    for (const room of house.rooms) {
      for (const task of room.tasks) {
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
        const email = document.getElementById("auth-email")?.value || "";
        const password = document.getElementById("auth-password")?.value || "";
        loginWithEmail(email, password);
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
      case "tab-plan":
        ui.tab = "plan";
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
        ui.modal = { type: "socialName", provider: btn.dataset.provider };
        render();
        break;
      case "social-confirm": {
        const name = document.getElementById("social-name-input")?.value || "";
        completeSocialLogin(ui.modal.provider, name);
        break;
      }
      case "social-skip":
        completeSocialLogin(ui.modal.provider, "");
        break;
      case "email-auth": {
        e.preventDefault();
        const email = document.getElementById("auth-email")?.value || "";
        const password = document.getElementById("auth-password")?.value || "";
        loginWithEmail(email, password);
        break;
      }
      case "open-house":
        ui.view = "house";
        ui.activeHouseId = btn.dataset.id;
        state.activeHouseId = btn.dataset.id;
        saveState();
        render();
        break;
      case "back-houses":
        ui.view = "houses";
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
        ui.modal = null;
        addRoom(getActiveHouse().id, name);
        break;
      }
      case "prompt-add-task":
        ui.modal = { type: "addTask", roomId: btn.dataset.room };
        render();
        break;
      case "confirm-add-task": {
        const name = document.getElementById("task-name-input")?.value || "";
        const min = Number(document.getElementById("task-min-input")?.value) || 15;
        const roomId = ui.modal.roomId;
        ui.modal = null;
        addTask(roomId, name, min);
        break;
      }
      case "toggle-done":
        toggleTaskDone(btn.dataset.id);
        break;
      case "skip":
        skipTask(btn.dataset.id);
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
        toast("Время сохранено");
        break;
      }
      case "close-timer":
        ui.stopwatch.running = false;
        if (ui.stopwatch.tick) clearInterval(ui.stopwatch.tick);
        ui.modal = null;
        render();
        break;
      case "suggest-30":
        ui.modal = { type: "suggest30", tasks: pick30MinTasks() };
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

  boot();
})();
