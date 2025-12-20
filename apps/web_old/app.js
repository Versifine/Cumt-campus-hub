const STORAGE_KEYS = {
  token: "campus-hub-token",
  afterLogin: "campus-hub-after-login",
  postContentCache: "campus-hub-post-content-cache-v1",
};

const state = {
  token: "",
  me: null,
};

const dom = {
  nav: document.getElementById("nav"),
  status: document.getElementById("status"),
  alert: document.getElementById("alert"),
  app: document.getElementById("app"),
};

function setStatus(text, tone) {
  dom.status.textContent = text || "就绪";
  dom.status.style.background = tone || "rgba(15, 31, 27, 0.08)";
}

function showAlert(message, tone) {
  if (!message) {
    dom.alert.textContent = "";
    dom.alert.classList.add("hidden");
    return;
  }
  dom.alert.textContent = message;
  dom.alert.style.background = tone || "rgba(255, 122, 89, 0.15)";
  dom.alert.classList.remove("hidden");
}

function setToken(token) {
  state.token = token || "";
  if (state.token) {
    localStorage.setItem(STORAGE_KEYS.token, state.token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.token);
  }
  renderNav();
}

function setMe(me) {
  state.me = me || null;
  renderNav();
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getPostContentCache() {
  const data = readJSON(STORAGE_KEYS.postContentCache, {});
  if (!data || typeof data !== "object") return {};
  return data;
}

function rememberPostContent(post) {
  const postId = post && typeof post.id === "string" ? post.id : "";
  const content = post && typeof post.content === "string" ? post.content : "";
  const title = post && typeof post.title === "string" ? post.title : "";
  const createdAt = post && typeof post.created_at === "string" ? post.created_at : "";
  if (!postId || !content) return;

  const cache = getPostContentCache();
  cache[postId] = { title, content, created_at: createdAt };

  // 简单限制一下缓存大小，避免无限增长（按插入顺序尽力截断）
  const keys = Object.keys(cache);
  if (keys.length > 50) {
    const toDrop = keys.slice(0, keys.length - 50);
    toDrop.forEach((k) => delete cache[k]);
  }
  writeJSON(STORAGE_KEYS.postContentCache, cache);
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  if (options.json) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body || null,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((data && data.message) || response.statusText);
  }
  if (data && typeof data.code === "number" && data.code !== 0) {
    throw new Error(data.message || "request failed");
  }
  return data;
}

async function loadMe() {
  if (!state.token) {
    setMe(null);
    return;
  }
  try {
    const me = await apiFetch("/api/v1/users/me");
    setMe(me);
  } catch {
    // token 失效时直接清掉，避免死循环
    setToken("");
    setMe(null);
  }
}

function getRoutePath() {
  const raw = (location.hash || "").replace(/^#/, "");
  return raw ? raw : "/";
}

function navigate(path) {
  location.hash = path.startsWith("#") ? path : `#${path}`;
}

function renderNav() {
  const path = getRoutePath();
  const links = [
    { href: "#/", label: "首页" },
    { href: "#/posts/new", label: "发帖" },
  ];

  dom.nav.replaceChildren();

  const left = document.createElement("div");
  left.className = "nav-links";
  links.forEach((item) => {
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = item.label;
    if (path === item.href.replace(/^#/, "")) a.classList.add("active");
    left.appendChild(a);
  });

  const right = document.createElement("div");
  right.className = "nav-user";

  if (state.token) {
    const meText = document.createElement("span");
    meText.className = "muted tiny";
    meText.textContent = state.me?.nickname ? `已登录：${state.me.nickname}` : "已登录";
    right.appendChild(meText);

    const logout = document.createElement("button");
    logout.className = "btn ghost";
    logout.type = "button";
    logout.textContent = "退出";
    logout.addEventListener("click", () => {
      setToken("");
      setMe(null);
      showAlert("已退出登录", "rgba(255, 122, 89, 0.15)");
      navigate("/");
    });
    right.appendChild(logout);
  } else {
    const login = document.createElement("a");
    login.href = "#/login";
    login.textContent = "登录";
    if (path === "/login") login.classList.add("active");
    right.appendChild(login);
  }

  dom.nav.appendChild(left);
  dom.nav.appendChild(right);
}

function renderNotFound() {
  dom.app.replaceChildren(
    card("未找到页面", [
      p("muted", "当前地址不存在。"),
      linkBtn("返回首页", () => navigate("/")),
    ]),
  );
}

function card(title, children) {
  const section = document.createElement("section");
  section.className = "card wide";
  const h2 = document.createElement("h2");
  h2.textContent = title;
  section.appendChild(h2);
  (children || []).forEach((child) => section.appendChild(child));
  return section;
}

function p(className, text) {
  const node = document.createElement("p");
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function metaLine(text) {
  const node = document.createElement("div");
  node.className = "tiny muted";
  node.textContent = text;
  return node;
}

function linkBtn(text, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn ghost";
  btn.textContent = text;
  btn.addEventListener("click", onClick);
  return btn;
}

function field(label, inputEl) {
  const wrapper = document.createElement("label");
  wrapper.className = "field";
  const span = document.createElement("span");
  span.textContent = label;
  wrapper.appendChild(span);
  wrapper.appendChild(inputEl);
  return wrapper;
}

async function renderHome() {
  setStatus("加载帖子…");
  showAlert("");

  const list = document.createElement("div");
  list.className = "list";

  const refresh = document.createElement("button");
  refresh.className = "btn ghost";
  refresh.type = "button";
  refresh.textContent = "刷新";
  refresh.addEventListener("click", () => {
    render().catch((err) => showAlert(err.message));
  });

  const titleRow = document.createElement("div");
  titleRow.className = "header-row";
  const title = document.createElement("h2");
  title.textContent = "帖子";
  titleRow.appendChild(title);
  const actions = document.createElement("div");
  actions.className = "row";
  actions.appendChild(refresh);
  titleRow.appendChild(actions);

  const wrap = document.createElement("section");
  wrap.className = "card wide";
  wrap.appendChild(titleRow);
  wrap.appendChild(metaLine("点击帖子进入详情页"));
  wrap.appendChild(list);

  dom.app.replaceChildren(wrap);

  const data = await apiFetch("/api/v1/posts");
  const items = Array.isArray(data?.items) ? data.items : [];
  const total = typeof data?.total === "number" ? data.total : items.length;

  list.replaceChildren();
  if (items.length === 0) {
    list.appendChild(p("muted", "暂无帖子。"));
  } else {
    wrap.insertBefore(metaLine(`共 ${total} 条`), list);
    items.forEach((item) => {
      const id = typeof item?.id === "string" ? item.id : "";
      const titleText = typeof item?.title === "string" ? item.title : "(无标题)";
      const nickname = typeof item?.author?.nickname === "string" ? item.author.nickname : "-";
      const createdAt = typeof item?.created_at === "string" ? item.created_at : "-";

      const a = document.createElement(id ? "a" : "div");
      a.className = id ? "list-item link-item" : "list-item";
      if (id) {
        a.href = `#/posts/${encodeURIComponent(id)}`;
      }

      const t = document.createElement("div");
      t.textContent = titleText;
      const m = metaLine(`${nickname} · ${createdAt}`);
      a.appendChild(t);
      a.appendChild(m);
      list.appendChild(a);
    });
  }

  setStatus("就绪", "rgba(63, 125, 106, 0.2)");
}

async function renderPostDetail(postId) {
  setStatus("加载详情…");
  showAlert("");

  const back = document.createElement("a");
  back.href = "#/";
  back.className = "tiny muted";
  back.textContent = "← 返回列表";

  const postTitle = document.createElement("div");
  postTitle.className = "post-title";
  postTitle.textContent = postId;

  const postMeta = metaLine("");
  const postContent = document.createElement("div");
  postContent.className = "panel";
  postContent.textContent = "加载中…";

  const commentsList = document.createElement("div");
  commentsList.className = "list";

  dom.app.replaceChildren(
    card("帖子详情", [
      back,
      postTitle,
      postMeta,
      p("tiny muted", "说明：当前 docs/api.md 未定义“获取单帖详情”接口，因此帖子内容仅在后端返回或本地缓存存在时显示。"),
      postContent,
      p("tiny muted", "评论列表"),
      commentsList,
    ]),
  );

  // 1) 尝试从帖子列表里找到标题/作者/时间（仅使用 docs/api.md 定义字段）
  const listPromise = apiFetch("/api/v1/posts?page=1&page_size=50").catch(() => null);

  // 2) 评论列表接口在 docs/api.md 中存在，但未给出响应结构，因此做容错渲染
  const commentsPromise = apiFetch(`/api/v1/posts/${encodeURIComponent(postId)}/comments`).catch((err) => err);

  const [listResp, commentsResp] = await Promise.all([listPromise, commentsPromise]);

  const listItems = Array.isArray(listResp?.items) ? listResp.items : [];
  const post = listItems.find((it) => it && typeof it.id === "string" && it.id === postId) || null;

  if (post) {
    postTitle.textContent = typeof post.title === "string" ? post.title : postId;
    const nickname = typeof post.author?.nickname === "string" ? post.author.nickname : "-";
    const createdAt = typeof post.created_at === "string" ? post.created_at : "-";
    postMeta.textContent = `${nickname} · ${createdAt}`;
  } else {
    postMeta.textContent = "未在帖子列表中找到该帖（可能不在第一页或已被删除）";
  }

  // 内容：优先使用本地缓存（来自“发帖”成功后的回包），否则如果后端未来在列表里增加 content 也能显示
  const cached = getPostContentCache()[postId];
  const cachedContent = cached && typeof cached.content === "string" ? cached.content : "";
  const contentFromList = typeof post?.content === "string" ? post.content : "";
  const content = cachedContent || contentFromList;
  postContent.textContent = content || "（暂无可展示的 content）";

  commentsList.replaceChildren();
  if (commentsResp instanceof Error) {
    showAlert(commentsResp.message);
    commentsList.appendChild(p("muted", "评论加载失败。"));
  } else if (!Array.isArray(commentsResp)) {
    commentsList.appendChild(p("muted", "评论接口返回格式非数组，已忽略。"));
  } else if (commentsResp.length === 0) {
    commentsList.appendChild(p("muted", "暂无评论。"));
  } else {
    commentsResp.forEach((c) => {
      const contentText = typeof c?.content === "string" ? c.content : JSON.stringify(c);
      const nickname = typeof c?.author?.nickname === "string" ? c.author.nickname : "-";
      const createdAt = typeof c?.created_at === "string" ? c.created_at : "-";

      const item = document.createElement("div");
      item.className = "list-item";

      const line = document.createElement("div");
      line.textContent = contentText;
      item.appendChild(line);
      item.appendChild(metaLine(`${nickname} · ${createdAt}`));

      commentsList.appendChild(item);
    });
  }

  setStatus("就绪", "rgba(63, 125, 106, 0.2)");
}

async function renderLogin() {
  setStatus("登录");
  showAlert("");

  if (state.token) {
    dom.app.replaceChildren(
      card("登录", [
        p("muted", "你已经登录。"),
        linkBtn("返回首页", () => navigate("/")),
      ]),
    );
    return;
  }

  const form = document.createElement("form");
  form.className = "stack";

  const account = document.createElement("input");
  account.type = "text";
  account.placeholder = "账号";
  account.autocomplete = "username";

  const password = document.createElement("input");
  password.type = "password";
  password.placeholder = "密码";
  password.autocomplete = "current-password";

  const submit = document.createElement("button");
  submit.className = "btn";
  submit.type = "submit";
  submit.textContent = "登录";

  form.appendChild(field("账号", account));
  form.appendChild(field("密码", password));
  form.appendChild(submit);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert("");
    setStatus("登录中…");
    submit.disabled = true;
    try {
      const payload = {
        account: (account.value || "").trim(),
        password: (password.value || "").trim(),
      };
      const data = await apiFetch("/api/v1/auth/login", {
        method: "POST",
        json: true,
        body: JSON.stringify(payload),
      });

      // docs/api.md 定义：token + user{id,nickname}
      if (typeof data?.token === "string") setToken(data.token);
      if (data?.user) setMe(data.user);

      const after = sessionStorage.getItem(STORAGE_KEYS.afterLogin);
      sessionStorage.removeItem(STORAGE_KEYS.afterLogin);
      navigate(after || "/");
      showAlert("登录成功", "rgba(63, 125, 106, 0.2)");
    } catch (err) {
      showAlert(err.message);
      setStatus("登录失败", "rgba(255, 122, 89, 0.15)");
    } finally {
      submit.disabled = false;
    }
  });

  dom.app.replaceChildren(
    card("登录", [
      p("tiny muted", "接口：POST /api/v1/auth/login（以 docs/api.md 为准）"),
      form,
    ]),
  );
}

function requireLogin() {
  if (state.token) return true;
  sessionStorage.setItem(STORAGE_KEYS.afterLogin, getRoutePath());
  navigate("/login");
  showAlert("请先登录");
  return false;
}

async function renderCreatePost() {
  setStatus("发帖");
  showAlert("");
  if (!requireLogin()) return;

  const form = document.createElement("form");
  form.className = "stack";

  const boardSelect = document.createElement("select");
  const boardFallback = document.createElement("input");
  boardFallback.type = "text";
  boardFallback.placeholder = "例如 b_1";
  boardFallback.className = "hidden";

  const title = document.createElement("input");
  title.type = "text";
  title.placeholder = "标题";

  const content = document.createElement("textarea");
  content.rows = 6;
  content.placeholder = "内容";

  const submit = document.createElement("button");
  submit.className = "btn";
  submit.type = "submit";
  submit.textContent = "发布";

  form.appendChild(field("版块", boardSelect));
  form.appendChild(field("版块 ID（当无法加载版块列表时使用）", boardFallback));
  form.appendChild(field("标题", title));
  form.appendChild(field("内容", content));
  form.appendChild(submit);

  dom.app.replaceChildren(
    card("发帖", [
      p("tiny muted", "接口：POST /api/v1/posts（以 docs/api.md 为准）"),
      form,
    ]),
  );

  // 预加载版块列表，用于选择 board_id（失败时允许手动填）
  try {
    const boards = await apiFetch("/api/v1/boards");
    if (!Array.isArray(boards)) throw new Error("boards response is not array");

    boardSelect.replaceChildren();
    boards.forEach((b) => {
      const id = typeof b?.id === "string" ? b.id : "";
      const name = typeof b?.name === "string" ? b.name : id;
      if (!id) return;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${name}（${id}）`;
      boardSelect.appendChild(opt);
    });

    if (boardSelect.options.length === 0) {
      throw new Error("no boards");
    }
  } catch {
    // boards 拉不下来就允许用户手动输入 board_id
    boardSelect.classList.add("hidden");
    boardFallback.classList.remove("hidden");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert("");
    setStatus("发布中…");
    submit.disabled = true;
    try {
      const boardId = boardSelect.classList.contains("hidden")
        ? (boardFallback.value || "").trim()
        : (boardSelect.value || "").trim();

      const payload = {
        board_id: boardId,
        title: (title.value || "").trim(),
        content: (content.value || "").trim(),
      };

      const data = await apiFetch("/api/v1/posts", {
        method: "POST",
        json: true,
        body: JSON.stringify(payload),
      });

      // 后端当前实现会回包包含 id/content 等；这里不强依赖字段，仅做“有则用”的增强
      rememberPostContent(data);

      const postId = typeof data?.id === "string" ? data.id : "";
      showAlert("发布成功", "rgba(63, 125, 106, 0.2)");
      if (postId) {
        navigate(`/posts/${encodeURIComponent(postId)}`);
      } else {
        navigate("/");
      }
    } catch (err) {
      showAlert(err.message);
      setStatus("发布失败", "rgba(255, 122, 89, 0.15)");
    } finally {
      submit.disabled = false;
    }
  });
}

async function render() {
  renderNav();

  const path = getRoutePath();
  const postMatch = path.match(/^\/posts\/([^/]+)$/);

  try {
    if (path === "/" || path === "") {
      await renderHome();
      return;
    }
    if (path === "/login") {
      await renderLogin();
      return;
    }
    if (path === "/posts/new") {
      await renderCreatePost();
      return;
    }
    if (postMatch) {
      await renderPostDetail(decodeURIComponent(postMatch[1]));
      return;
    }

    renderNotFound();
  } catch (err) {
    showAlert(err.message || "unknown error");
    setStatus("出错了", "rgba(255, 122, 89, 0.15)");
  }
}

function init() {
  setToken(localStorage.getItem(STORAGE_KEYS.token) || "");
  renderNav();
  window.addEventListener("hashchange", () => {
    render().catch(() => null);
  });
  loadMe().finally(() => {
    render().catch(() => null);
  });
}

init();
