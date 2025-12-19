const state = {
  baseUrl: "http://localhost:8080",
  token: "",
  user: null,
  boardId: "",
  postId: "",
  ws: null,
  wsConnected: false,
  requestSeq: 0,
};

const el = {
  status: document.getElementById("status"),
  baseUrl: document.getElementById("baseUrl"),
  saveBaseUrl: document.getElementById("saveBaseUrl"),
  healthCheck: document.getElementById("healthCheck"),
  healthOutput: document.getElementById("healthOutput"),
  loginForm: document.getElementById("loginForm"),
  logout: document.getElementById("logout"),
  account: document.getElementById("account"),
  password: document.getElementById("password"),
  token: document.getElementById("token"),
  currentUser: document.getElementById("currentUser"),
  loadBoards: document.getElementById("loadBoards"),
  boards: document.getElementById("boards"),
  loadPosts: document.getElementById("loadPosts"),
  posts: document.getElementById("posts"),
  selectedPost: document.getElementById("selectedPost"),
  postForm: document.getElementById("postForm"),
  postBoard: document.getElementById("postBoard"),
  postTitle: document.getElementById("postTitle"),
  postContent: document.getElementById("postContent"),
  comments: document.getElementById("comments"),
  commentForm: document.getElementById("commentForm"),
  commentContent: document.getElementById("commentContent"),
  fileForm: document.getElementById("fileForm"),
  fileInput: document.getElementById("fileInput"),
  fileResult: document.getElementById("fileResult"),
  connectWs: document.getElementById("connectWs"),
  disconnectWs: document.getElementById("disconnectWs"),
  chatLog: document.getElementById("chatLog"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
};

function setStatus(text, tone) {
  el.status.textContent = text;
  el.status.style.background = tone || "rgba(15, 31, 27, 0.08)";
}

function setToken(token) {
  state.token = token || "";
  localStorage.setItem("campus-hub-token", state.token);
  el.token.textContent = state.token || "-";
}

function setBaseUrl(url) {
  state.baseUrl = url.replace(/\/$/, "");
  localStorage.setItem("campus-hub-baseUrl", state.baseUrl);
  el.baseUrl.value = state.baseUrl;
}

function setUser(user) {
  state.user = user;
  if (!user) {
    el.currentUser.textContent = "-";
    return;
  }
  el.currentUser.textContent = `${user.id} (${user.nickname})`;
}

async function apiFetch(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  if (options.json) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${state.baseUrl}${path}`, {
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

async function healthCheck() {
  try {
    const data = await apiFetch("/healthz");
    el.healthOutput.textContent = JSON.stringify(data);
  } catch (err) {
    el.healthOutput.textContent = err.message;
  }
}

async function login(account, password) {
  const payload = {
    account: account || "anonymous",
    password: password || "demo",
  };
  const data = await apiFetch("/api/v1/auth/login", {
    method: "POST",
    json: true,
    body: JSON.stringify(payload),
  });
  setToken(data.token);
  setUser(data.user);
  setStatus("Logged in", "rgba(63, 125, 106, 0.2)");
}

async function loadMe() {
  if (!state.token) {
    return;
  }
  try {
    const data = await apiFetch("/api/v1/users/me");
    setUser(data);
  } catch (err) {
    setUser(null);
  }
}

async function loadBoards() {
  const boards = await apiFetch("/api/v1/boards");
  renderBoards(boards);
  renderBoardOptions(boards);
}

async function loadPosts() {
  const query = state.boardId ? `?board_id=${encodeURIComponent(state.boardId)}` : "";
  const data = await apiFetch(`/api/v1/posts${query}`);
  renderPosts(data.items || []);
}

async function loadComments() {
  if (!state.postId) {
    return;
  }
  const data = await apiFetch(`/api/v1/posts/${state.postId}/comments`);
  renderComments(data || []);
}

async function createPost() {
  const payload = {
    board_id: el.postBoard.value,
    title: el.postTitle.value.trim(),
    content: el.postContent.value.trim(),
  };
  await apiFetch("/api/v1/posts", {
    method: "POST",
    json: true,
    body: JSON.stringify(payload),
  });
  el.postTitle.value = "";
  el.postContent.value = "";
  await loadPosts();
}

async function createComment() {
  if (!state.postId) {
    return;
  }
  const payload = {
    content: el.commentContent.value.trim(),
  };
  await apiFetch(`/api/v1/posts/${state.postId}/comments`, {
    method: "POST",
    json: true,
    body: JSON.stringify(payload),
  });
  el.commentContent.value = "";
  await loadComments();
}

async function uploadFile(file) {
  const form = new FormData();
  form.append("file", file);
  const data = await apiFetch("/api/v1/files", {
    method: "POST",
    body: form,
  });
  el.fileResult.innerHTML = `Uploaded <span class="mono">${data.id}</span> - <a href="${state.baseUrl}${data.url}" target="_blank">Download</a>`;
}

function renderBoards(boards) {
  el.boards.innerHTML = "";
  const allButton = document.createElement("button");
  allButton.className = `pill ${state.boardId === "" ? "active" : ""}`;
  allButton.textContent = "All";
  allButton.addEventListener("click", () => {
    state.boardId = "";
    renderBoards(boards);
    loadPosts().catch(() => null);
  });
  el.boards.appendChild(allButton);

  boards.forEach((board) => {
    const button = document.createElement("button");
    button.className = `pill ${state.boardId === board.id ? "active" : ""}`;
    button.textContent = board.name;
    button.addEventListener("click", () => {
      state.boardId = board.id;
      renderBoards(boards);
      loadPosts().catch(() => null);
    });
    el.boards.appendChild(button);
  });
}

function renderBoardOptions(boards) {
  el.postBoard.innerHTML = "";
  boards.forEach((board) => {
    const option = document.createElement("option");
    option.value = board.id;
    option.textContent = `${board.name} (${board.id})`;
    el.postBoard.appendChild(option);
  });
}

function renderPosts(posts) {
  el.posts.innerHTML = "";
  if (posts.length === 0) {
    el.posts.innerHTML = '<div class="muted tiny">No posts yet.</div>';
    return;
  }
  posts.forEach((post) => {
    const item = document.createElement("div");
    item.className = `list-item ${state.postId === post.id ? "active" : ""}`;
    item.innerHTML = `
      <div><strong>${post.title}</strong></div>
      <div class="tiny muted">${post.author?.nickname || "-"} · ${post.created_at}</div>
    `;
    item.addEventListener("click", () => {
      state.postId = post.id;
      renderPosts(posts);
      renderSelectedPost(post);
      loadComments().catch(() => null);
    });
    el.posts.appendChild(item);
  });
}

function renderSelectedPost(post) {
  el.selectedPost.innerHTML = `
    <div class="mono">${post.id}</div>
    <div><strong>${post.title}</strong></div>
    <div class="tiny muted">${post.author?.nickname || "-"}</div>
  `;
}

function renderComments(comments) {
  el.comments.innerHTML = "";
  if (comments.length === 0) {
    el.comments.innerHTML = '<div class="muted tiny">No comments yet.</div>';
    return;
  }
  comments.forEach((comment) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>${comment.content}</div>
      <div class="tiny muted">${comment.author?.nickname || "-"} · ${comment.created_at}</div>
    `;
    el.comments.appendChild(item);
  });
}

function connectWs() {
  if (!state.token) {
    appendChat("system", "Login first.");
    return;
  }
  if (state.ws) {
    state.ws.close();
  }
  const wsUrl = state.baseUrl.replace(/^http/, "ws") + `/ws/chat?token=${encodeURIComponent(state.token)}`;
  const socket = new WebSocket(wsUrl);
  state.ws = socket;

  socket.addEventListener("open", () => {
    state.wsConnected = true;
    setStatus("WS connected", "rgba(63, 125, 106, 0.2)");
    appendChat("system", "WebSocket connected");
    sendWs("chat.join", { roomId: "public" });
    sendWs("chat.history", { roomId: "public", limit: 20 });
  });

  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data || "{}");
    handleWs(payload);
  });

  socket.addEventListener("close", () => {
    state.wsConnected = false;
    setStatus("WS closed", "rgba(255, 122, 89, 0.15)");
    appendChat("system", "WebSocket disconnected");
  });
}

function disconnectWs() {
  if (state.ws) {
    state.ws.close();
    state.ws = null;
  }
}

function sendWs(type, data) {
  if (!state.ws) {
    return;
  }
  state.requestSeq += 1;
  const message = {
    v: 1,
    type,
    requestId: `req-${state.requestSeq}`,
    data,
  };
  state.ws.send(JSON.stringify(message));
}

function handleWs(payload) {
  if (!payload || !payload.type) {
    return;
  }
  if (payload.type === "chat.message") {
    const msg = payload.data;
    appendChat(msg?.sender?.nickname || "user", msg?.content || "");
    return;
  }
  if (payload.type === "chat.history.result") {
    const items = payload.data?.items || [];
    items.forEach((item) => {
      appendChat("history", item.content || "");
    });
    return;
  }
  if (payload.type === "system.connected") {
    appendChat("system", `Connected as ${payload.data?.userId || ""}`);
    return;
  }
  if (payload.type === "chat.joined") {
    appendChat("system", `Joined ${payload.data?.roomId || ""}`);
    return;
  }
  if (payload.type === "error") {
    appendChat("error", payload.error?.message || "unknown error");
  }
}

function appendChat(label, content) {
  const line = document.createElement("div");
  line.className = "chat-line";
  line.innerHTML = `<span>${label}</span><span>${content}</span>`;
  el.chatLog.appendChild(line);
  el.chatLog.scrollTop = el.chatLog.scrollHeight;
}

function initFromStorage() {
  const savedBase = localStorage.getItem("campus-hub-baseUrl");
  if (savedBase) {
    setBaseUrl(savedBase);
  } else {
    setBaseUrl(state.baseUrl);
  }
  const savedToken = localStorage.getItem("campus-hub-token");
  if (savedToken) {
    setToken(savedToken);
    loadMe().catch(() => null);
  }
}

el.saveBaseUrl.addEventListener("click", () => {
  setBaseUrl(el.baseUrl.value.trim() || "http://localhost:8080");
});

el.healthCheck.addEventListener("click", () => {
  healthCheck().catch(() => null);
});

el.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  login(el.account.value, el.password.value)
    .then(() => loadBoards())
    .then(() => loadPosts())
    .catch((err) => appendChat("error", err.message));
});

el.logout.addEventListener("click", () => {
  setToken("");
  setUser(null);
  disconnectWs();
  setStatus("Logged out", "rgba(255, 122, 89, 0.15)");
});

el.loadBoards.addEventListener("click", () => {
  loadBoards().catch((err) => appendChat("error", err.message));
});

el.loadPosts.addEventListener("click", () => {
  loadPosts().catch((err) => appendChat("error", err.message));
});

el.postForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createPost().catch((err) => appendChat("error", err.message));
});

el.commentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createComment().catch((err) => appendChat("error", err.message));
});

el.fileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const file = el.fileInput.files[0];
  if (!file) {
    return;
  }
  uploadFile(file).catch((err) => appendChat("error", err.message));
});

el.connectWs.addEventListener("click", () => {
  connectWs();
});

el.disconnectWs.addEventListener("click", () => {
  disconnectWs();
});

el.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = el.chatInput.value.trim();
  if (!content) {
    return;
  }
  sendWs("chat.send", { roomId: "public", content });
  el.chatInput.value = "";
});

initFromStorage();
loadBoards().catch(() => null);
loadPosts().catch(() => null);
