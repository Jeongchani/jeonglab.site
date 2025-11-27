// src/ui/app.ts
import type { LinkItem, LinkCategory } from "../types/link";

export type SelectedCategory = "All" | LinkCategory;

const CATEGORIES: LinkCategory[] = [
  "Project",
  "Study",
  "Server",
  "Tool",
  "Docs",
  "Etc"
];

const CHIP_LABELS: Record<SelectedCategory, string> = {
  All: "All",
  Project: "Project",
  Study: "Study",
  Server: "Server",
  Tool: "Tool",
  Docs: "Docs",
  Etc: "Etc"
};

type PanelMode = "closed" | "create" | "edit";

const AUTH_KEY = "jeongsite_admin_v1";
// ⚠️ 프론트에서만 쓰는 관리자 비밀번호 (진짜 보안은 Cloudflare/Tailscale로)
const ADMIN_PASSWORD = "change-this-password";

// 개발(로컬)에서는 4000 포트, 배포에서는 동일 오리진(/api)
const API_BASE =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1")
    ? "http://localhost:4000"
    : "";

// API 요청용 유틸
function apiUrl(path: string): string {
  return (API_BASE || "") + path;
}

interface AppState {
  links: LinkItem[];
  selected: SelectedCategory;
  isEditing: boolean;
  panelMode: PanelMode;
  panelTargetId: string | null;
  isAuthed: boolean;
  loginPanelOpen: boolean;
  backupPanelOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
}

export function initApp(root: HTMLElement, initialLinks: LinkItem[]) {
  let isAuthedInitial = false;
  try {
    if (typeof window !== "undefined") {
      isAuthedInitial = window.localStorage.getItem(AUTH_KEY) === "1";
    }
  } catch {
    // ignore
  }

  let state: AppState = {
    links: sortLinks(initialLinks),
    selected: "All",
    isEditing: false,
    panelMode: "closed",
    panelTargetId: null,
    isAuthed: isAuthedInitial,
    loginPanelOpen: false,
    backupPanelOpen: false,
    isLoading: false,
    isSaving: false
  };

  const setState = (patch: Partial<AppState>) => {
    state = { ...state, ...patch };
    render();
  };

  const render = () => {
    const html = buildAppHtml(state);
    root.innerHTML = html;
    attachHandlers(root, state, setState);
  };

  render();

  // 첫 렌더 후 서버에서 최신 링크 불러오기
  if (typeof window !== "undefined") {
    void syncLinksFromServer(setState);
  }
}

// 서버에서 링크 가져오기
async function syncLinksFromServer(
  setState: (patch: Partial<AppState>) => void
) {
  if (typeof fetch === "undefined") return;
  setState({ isLoading: true });
  try {
    const res = await fetch(apiUrl("/api/links"));
    if (!res.ok) {
      console.warn("Failed to load links from API:", res.status);
      return;
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      setState({ links: sortLinks(data as LinkItem[]) });
    } else {
      console.warn("API /api/links did not return array");
    }
  } catch (err) {
    console.warn("Error fetching /api/links:", err);
  } finally {
    setState({ isLoading: false });
  }
}

// 정렬 기준: pinned 우선 + order + category
function sortLinks(list: LinkItem[]): LinkItem[] {
  return [...list].sort((a, b) => {
    // 1) pinned 먼저
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    const ao = a.order ?? 0;
    const bo = b.order ?? 0;

    // 2) pinned 끼리는 order만
    if (a.pinned && b.pinned) {
      if (ao !== bo) return ao - bo;
      return (a.title || "").localeCompare(b.title || "", "ko");
    }

    // 3) 나머지: category → order → title
    if (a.category !== b.category) {
      return (a.category || "").localeCompare(b.category || "");
    }
    if (ao !== bo) return ao - bo;
    return (a.title || "").localeCompare(b.title || "", "ko");
  });
}

function buildAppHtml(state: AppState): string {
  const {
    links,
    selected,
    isEditing,
    panelMode,
    panelTargetId,
    isAuthed,
    loginPanelOpen,
    backupPanelOpen
    // isLoading,
    // isSaving
  } = state;

  // 로그인 여부에 따라 private 표시 여부 결정
  const baseLinks = isAuthed
    ? links
    : links.filter((l) => l.visibility === "public");

  const visibleLinks =
    selected === "All"
      ? baseLinks
      : baseLinks.filter((l) => l.category === selected);

  const pinned = visibleLinks.filter((l) => l.pinned);
  const nonPinned = visibleLinks.filter((l) => !l.pinned);

  let sectionsHtml = "";

  if (selected === "All") {
    sectionsHtml += buildPinnedSection(pinned, "전체 Pinned", isEditing);

    for (const cat of CATEGORIES) {
      const categoryLinks = nonPinned.filter((l) => l.category === cat);
      if (!categoryLinks.length) continue;
      sectionsHtml += buildCategorySection(cat, categoryLinks, isEditing);
    }
  } else {
    sectionsHtml += buildPinnedSection(
      pinned,
      `${CHIP_LABELS[selected]} · Pinned`,
      isEditing
    );
    if (nonPinned.length) {
      sectionsHtml += buildCategorySection(selected, nonPinned, isEditing);
    }
  }

  if (!sectionsHtml.trim()) {
    sectionsHtml = `<p class="empty-text">표시할 링크가 없습니다.</p>`;
  }

  const panelLink =
    panelMode === "edit" && panelTargetId
      ? links.find((l) => l.id === panelTargetId) ?? null
      : null;

  const editPanelHtml = buildEditPanel(state, panelLink);
  const loginPanelHtml = buildLoginPanel(state);
  const backupPanelHtml = buildBackupPanel(state);

  let headerActionsHtml = "";

  if (!isAuthed) {
    headerActionsHtml = `
      <button class="btn-ghost" type="button">🌗 테마</button>
      <button class="btn-primary" type="button" data-role="open-login">
        로그인
      </button>
    `;
  } else {
    headerActionsHtml = `
      <button class="btn-ghost" type="button">🌗 테마</button>
      <button class="btn-ghost" type="button" data-role="open-backup">
        백업
      </button>
      ${
        isEditing
          ? `<button class="btn-secondary" type="button" data-role="add-link">➕ 새 링크</button>`
          : ""
      }
      <button class="btn-primary" type="button" data-role="toggle-edit">
        ${isEditing ? "편집 종료" : "편집"}
      </button>
      <button class="btn-ghost" type="button" data-role="logout">
        로그아웃
      </button>
    `;
  }

  return `
    <div class="app-shell ${isEditing ? "is-editing" : ""}">
      <header class="app-header">
        <div>
          <h1 class="app-title">jeong.site · 북마크 허브</h1>
          <p class="app-subtitle">
            Pinned / Category 기반 단일 페이지 북마크
            ${
              isEditing
                ? `<span class="edit-badge">편집 모드</span>`
                : ""
            }
          </p>
        </div>
        <div class="app-header-actions">
          ${headerActionsHtml}
        </div>
      </header>

      <section class="chip-row">
        ${buildChipsHtml(selected)}
      </section>

      <main class="app-main">
        ${sectionsHtml}
      </main>

      ${editPanelHtml}
      ${loginPanelHtml}
      ${backupPanelHtml}
    </div>
  `;
}

function buildChipsHtml(selected: SelectedCategory): string {
  const all: SelectedCategory[] = ["All", ...CATEGORIES];
  return all
    .map((cat) => {
      const active = cat === selected;
      return `
        <button
          type="button"
          class="chip ${active ? "chip-active" : ""}"
          data-role="category-chip"
          data-category="${cat}"
        >
          ${CHIP_LABELS[cat]}
        </button>
      `;
    })
    .join("");
}

function buildPinnedSection(
  pinned: LinkItem[],
  title: string,
  isEditing: boolean
): string {
  if (!pinned.length) return "";
  return `
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">📌 ${title}</h2>
      </div>
      <div class="card-grid">
        ${pinned.map((l) => renderCard(l, isEditing)).join("")}
      </div>
    </section>
  `;
}

function buildCategorySection(
  category: LinkCategory | SelectedCategory,
  links: LinkItem[],
  isEditing: boolean
): string {
  if (!links.length) return "";
  const label = CHIP_LABELS[category as SelectedCategory] ?? String(category);
  return `
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">${label}</h2>
      </div>
      <div class="card-grid">
        ${links.map((l) => renderCard(l, isEditing)).join("")}
      </div>
    </section>
  `;
}

function renderCard(link: LinkItem, isEditing: boolean): string {
  const url = escapeHtml(link.url);
  const title = escapeHtml(link.title);
  const notes = link.notes ? escapeHtml(link.notes) : "";
  const badge = link.pinned ? `<span class="badge">PINNED</span>` : "";
  const iconText = renderIconText(link.icon);

  if (isEditing) {
    // 편집 모드: div + draggable
    return `
      <div
        class="card card-editable"
        draggable="true"
        data-role="card-draggable"
        data-id="${link.id}"
      >
        <div class="card-icon">${iconText}</div>
        <div class="card-body" data-role="edit-link" data-id="${link.id}">
          <div class="card-title-row">
            <h3 class="card-title">${title}</h3>
            ${badge}
          </div>
          ${notes ? `<p class="card-notes">${notes}</p>` : ""}
          <p class="card-url">${url}</p>
        </div>
      </div>
    `;
  }

  return `
    <a class="card" href="${url}" target="_blank" rel="noreferrer">
      <div class="card-icon">${iconText}</div>
      <div class="card-body">
        <div class="card-title-row">
          <h3 class="card-title">${title}</h3>
          ${badge}
        </div>
        ${notes ? `<p class="card-notes">${notes}</p>` : ""}
        <p class="card-url">${url}</p>
      </div>
    </a>
  `;
}

function renderIconText(icon: string): string {
  if (icon.startsWith("emoji:")) {
    const parts = icon.split("emoji:");
    return parts[1] && parts[1].trim() ? parts[1].trim() : "🔗";
  }
  if (icon.startsWith("si-")) {
    return icon.replace("si-", "").toUpperCase().slice(0, 3);
  }
  if (icon.startsWith("custom:")) {
    return "SVG";
  }
  return "🔗";
}

function buildEditPanel(state: AppState, current: LinkItem | null): string {
  const { panelMode, selected } = state;
  if (panelMode === "closed") return "";

  const isCreate = panelMode === "create";

  const nowCategory: LinkCategory =
    isCreate
      ? selected === "All"
        ? "Project"
        : (selected as LinkCategory)
      : current?.category ?? "Project";

  const titleValue = isCreate ? "" : current?.title ?? "";
  const urlValue = isCreate ? "" : current?.url ?? "";
  const iconValue = isCreate ? "" : current?.icon ?? "";
  const notesValue = isCreate ? "" : current?.notes ?? "";
  const orderValue = isCreate ? "" : String(current?.order ?? "");
  const visibilityValue = isCreate
    ? "public"
    : current?.visibility ?? "public";
  const pinnedChecked =
    isCreate ? "" : current?.pinned ? "checked" : "";

  const heading = isCreate ? "새 링크 추가" : "링크 편집";

  const categoryOptions = CATEGORIES.map((c) => {
    const selectedAttr = c === nowCategory ? "selected" : "";
    return `<option value="${c}" ${selectedAttr}>${CHIP_LABELS[c]}</option>`;
  }).join("");

  const visibilityOptions = ["public", "private"]
    .map((v) => {
      const sel = v === visibilityValue ? "selected" : "";
      const label = v === "public" ? "public" : "private";
      return `<option value="${v}" ${sel}>${label}</option>`;
    })
    .join("");

  return `
    <aside class="edit-panel">
      <div class="edit-panel-header">
        <h3 class="edit-panel-title">${heading}</h3>
        <button
          type="button"
          class="btn-icon"
          data-role="panel-close"
        >
          ✕
        </button>
      </div>

      <form class="edit-panel-body" data-role="edit-form">
        <div class="edit-panel-row">
          <label class="edit-label">제목</label>
          <input
            class="edit-input"
            name="title"
            type="text"
            required
            value="${escapeAttr(titleValue)}"
            placeholder="예: Heart App · Flutter"
          />
        </div>

        <div class="edit-panel-row">
          <label class="edit-label">URL</label>
          <input
            class="edit-input"
            name="url"
            type="url"
            required
            value="${escapeAttr(urlValue)}"
            placeholder="https://..."
          />
        </div>

        <div class="edit-panel-row">
          <label class="edit-label">카테고리</label>
          <select class="edit-input" name="category">
            ${categoryOptions}
          </select>
        </div>

        <div class="edit-panel-row">
          <label class="edit-label">아이콘</label>
          <input
            class="edit-input"
            name="icon"
            type="text"
            value="${escapeAttr(iconValue)}"
            placeholder="emoji:🚀, si-github, custom:xxx.svg"
          />
        </div>

        <div class="edit-panel-row edit-panel-inline">
          <label class="edit-label-inline">
            <input
              type="checkbox"
              name="pinned"
              ${pinnedChecked}
            />
            핀(Pinned)
          </label>

          <label class="edit-label-inline">
            visibility:
            <select class="edit-input-inline" name="visibility">
              ${visibilityOptions}
            </select>
          </label>

          <label class="edit-label-inline">
            order:
            <input
              class="edit-input-inline"
              name="order"
              type="number"
              value="${escapeAttr(orderValue)}"
              placeholder="0"
            />
          </label>
        </div>

        <div class="edit-panel-row">
          <label class="edit-label">메모</label>
          <textarea
            class="edit-input"
            name="notes"
            rows="3"
            placeholder="간단한 설명"
          >${escapeHtmlTextArea(notesValue)}</textarea>
        </div>

        <div class="edit-panel-actions">
          ${
            !isCreate
              ? `<button
                   type="button"
                   class="btn-danger"
                   data-role="panel-delete"
                 >
                   삭제
                 </button>`
              : `<span></span>`
          }
          <div class="edit-panel-actions-right">
            <button
              type="button"
              class="btn-ghost-sm"
              data-role="panel-close"
            >
              취소
            </button>
            <button
              type="submit"
              class="btn-primary-sm"
              data-role="panel-save"
            >
              저장
            </button>
          </div>
        </div>
      </form>
    </aside>
  `;
}

function buildLoginPanel(state: AppState): string {
  const { loginPanelOpen, isAuthed } = state;
  if (!loginPanelOpen || isAuthed) return "";

  return `
    <aside class="edit-panel">
      <div class="edit-panel-header">
        <h3 class="edit-panel-title">관리자 로그인</h3>
        <button
          type="button"
          class="btn-icon"
          data-role="login-cancel"
        >
          ✕
        </button>
      </div>

      <form class="edit-panel-body" data-role="login-form">
        <div class="edit-panel-row">
          <label class="edit-label">비밀번호</label>
          <input
            class="edit-input"
            name="password"
            type="password"
            required
            placeholder="관리자 비밀번호"
          />
        </div>

        <div class="edit-panel-actions">
          <span></span>
          <div class="edit-panel-actions-right">
            <button
              type="button"
              class="btn-ghost-sm"
              data-role="login-cancel"
            >
              취소
            </button>
            <button
              type="submit"
              class="btn-primary-sm"
            >
              로그인
            </button>
          </div>
        </div>
      </form>
    </aside>
  `;
}

function buildBackupPanel(state: AppState): string {
  const { backupPanelOpen, isAuthed } = state;
  if (!backupPanelOpen || !isAuthed) return "";

  return `
    <aside class="edit-panel">
      <div class="edit-panel-header">
        <h3 class="edit-panel-title">백업 / 복원</h3>
        <button
          type="button"
          class="btn-icon"
          data-role="backup-close"
        >
          ✕
        </button>
      </div>

      <div class="edit-panel-body">
        <div class="edit-panel-row">
          <p class="edit-label">
            현재 <strong>서버에 저장된 링크 상태</strong>를 JSON 파일로 내보내거나,
            JSON 파일을 불러와서 서버 상태를 복원할 수 있습니다.
          </p>
        </div>

        <div class="edit-panel-actions">
          <button
            type="button"
            class="btn-ghost-sm"
            data-role="backup-export"
          >
            JSON 내보내기
          </button>
          <div class="edit-panel-actions-right">
            <button
              type="button"
              class="btn-ghost-sm"
              data-role="backup-reset"
            >
              전체 초기화
            </button>
            <button
              type="button"
              class="btn-primary-sm"
              data-role="backup-import"
            >
              JSON 가져오기
            </button>
          </div>
        </div>
      </div>
    </aside>
  `;
}

// --------------------- 이벤트 바인딩 ---------------------

function attachHandlers(
  root: HTMLElement,
  state: AppState,
  setState: (patch: Partial<AppState>) => void
) {
  // 카테고리 칩
  const chips = root.querySelectorAll<HTMLButtonElement>(
    "[data-role='category-chip']"
  );
  chips.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.category as SelectedCategory | undefined;
      if (!cat) return;
      if (cat === state.selected) return;
      setState({ selected: cat });
    });
  });

  // 편집 토글
  const editToggle = root.querySelector<HTMLButtonElement>(
    "[data-role='toggle-edit']"
  );
  if (editToggle) {
    editToggle.addEventListener("click", () => {
      const next = !state.isEditing;
      setState({
        isEditing: next,
        panelMode: "closed",
        panelTargetId: null,
        backupPanelOpen: false
      });
    });
  }

  // 새 링크 추가
  const addBtn = root.querySelector<HTMLButtonElement>(
    "[data-role='add-link']"
  );
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      setState({
        isEditing: true,
        panelMode: "create",
        panelTargetId: null,
        backupPanelOpen: false
      });
    });
  }

  // 드래그 정렬
  let dragSrcId: string | null = null;

  const dragCards = root.querySelectorAll<HTMLElement>(
    "[data-role='card-draggable']"
  );
  dragCards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      const id = card.dataset.id ?? null;
      dragSrcId = id;
      if (e.dataTransfer && id) {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
      }
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      card.classList.add("card-drag-over");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("card-drag-over");
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("card-drag-over");

      const toId = card.dataset.id ?? null;
      let fromId = dragSrcId;

      if (!fromId && e.dataTransfer) {
        const dt = e.dataTransfer.getData("text/plain");
        if (dt) fromId = dt;
      }

      dragSrcId = null;

      if (!fromId || !toId || fromId === toId) return;

      const next = reorderLinksByDrag(state.links, fromId, toId);
      if (next !== state.links) {
        setState({ links: next });
        void syncReorderToServer(fromId, toId);
      }
    });
  });

  // 카드 클릭 → 편집 패널
  const editTargets = root.querySelectorAll<HTMLElement>(
    "[data-role='edit-link']"
  );
  editTargets.forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.id;
      if (!id) return;
      setState({
        isEditing: true,
        panelMode: "edit",
        panelTargetId: id,
        backupPanelOpen: false
      });
    });
  });

  // 편집 패널 닫기
  const closeBtns = root.querySelectorAll<HTMLButtonElement>(
    "[data-role='panel-close']"
  );
  closeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setState({
        panelMode: "closed",
        panelTargetId: null
      });
    });
  });

  // 편집 저장
  const form = root.querySelector<HTMLFormElement>("[data-role='edit-form']");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void handleSave(form, state, setState);
    });
  }

  // 편집 삭제
  const delBtn = root.querySelector<HTMLButtonElement>(
    "[data-role='panel-delete']"
  );
  if (delBtn) {
    delBtn.addEventListener("click", () => {
      void handleDelete(state, setState);
    });
  }

  // 로그인 패널 열기
  const openLogin = root.querySelector<HTMLButtonElement>(
    "[data-role='open-login']"
  );
  if (openLogin) {
    openLogin.addEventListener("click", () => {
      setState({ loginPanelOpen: true, backupPanelOpen: false });
    });
  }

  // 로그인 취소
  const loginCancelBtns = root.querySelectorAll<HTMLButtonElement>(
    "[data-role='login-cancel']"
  );
  loginCancelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setState({ loginPanelOpen: false });
    });
  });

  // 로그인 폼
  const loginForm =
    root.querySelector<HTMLFormElement>("[data-role='login-form']");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      handleLogin(loginForm, setState);
    });
  }

  // 로그아웃
  const logoutBtn = root.querySelector<HTMLButtonElement>(
    "[data-role='logout']"
  );
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      try {
        window.localStorage.removeItem(AUTH_KEY);
      } catch {
        // ignore
      }
      setState({
        isAuthed: false,
        isEditing: false,
        panelMode: "closed",
        panelTargetId: null,
        backupPanelOpen: false
      });
    });
  }

  // 백업 패널 열기
  const openBackup = root.querySelector<HTMLButtonElement>(
    "[data-role='open-backup']"
  );
  if (openBackup) {
    openBackup.addEventListener("click", () => {
      setState({
        backupPanelOpen: true,
        panelMode: "closed",
        panelTargetId: null,
        loginPanelOpen: false
      });
    });
  }

  // 백업 패널 닫기
  const backupCloseBtns = root.querySelectorAll<HTMLButtonElement>(
    "[data-role='backup-close']"
  );
  backupCloseBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setState({ backupPanelOpen: false });
    });
  });

  // JSON 내보내기 (현재 state.links를 파일로)
  const backupExportBtn = root.querySelector<HTMLButtonElement>(
    "[data-role='backup-export']"
  );
  if (backupExportBtn) {
    backupExportBtn.addEventListener("click", () => {
      exportLinks(state.links);
    });
  }

  // JSON 가져오기 → 서버에 반영
  const backupImportBtn = root.querySelector<HTMLButtonElement>(
    "[data-role='backup-import']"
  );
  if (backupImportBtn) {
    backupImportBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const text = String(reader.result ?? "");
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) {
              alert("JSON 최상위는 배열이어야 합니다.");
              return;
            }
            void syncBackupImport(parsed as LinkItem[], setState);
          } catch {
            alert("JSON 파싱에 실패했습니다.");
          }
        };
        reader.readAsText(file, "utf-8");
      });
      input.click();
    });
  }

  // 서버 데이터 전체 초기화 (빈 배열로 덮어쓰기)
  const backupResetBtn = root.querySelector<HTMLButtonElement>(
    "[data-role='backup-reset']"
  );
  if (backupResetBtn) {
    backupResetBtn.addEventListener("click", () => {
      const ok = window.confirm(
        "서버에 저장된 모든 링크를 삭제하고 빈 상태로 초기화할까요?\n(백업 JSON이 없다면 되돌릴 수 없습니다)"
      );
      if (!ok) return;
      void syncBackupImport([], setState);
    });
  }
}

// --------------------- 로직 ---------------------

async function handleSave(
  form: HTMLFormElement,
  state: AppState,
  setState: (patch: Partial<AppState>) => void
) {
  const fd = new FormData(form);

  const title = String(fd.get("title") ?? "").trim();
  const url = String(fd.get("url") ?? "").trim();
  const categoryStr = String(fd.get("category") ?? "Project") as LinkCategory;
  const icon = String(fd.get("icon") ?? "").trim();
  const notes = String(fd.get("notes") ?? "").trim();
  const visibility = (String(fd.get("visibility") ?? "public") ||
    "public") as "public" | "private";
  const orderRaw = String(fd.get("order") ?? "").trim();

  const order =
    orderRaw === "" ? undefined : Number(orderRaw);
  const pinned =
    form.querySelector<HTMLInputElement>("input[name='pinned']")?.checked ??
    false;

  if (!title || !url) {
    alert("제목과 URL은 필수입니다.");
    return;
  }

  const payload = {
    title,
    url,
    category: categoryStr,
    icon: icon || undefined,
    notes: notes || undefined,
    pinned,
    visibility,
    order
  };

  setState({ isSaving: true });

  try {
    if (state.panelMode === "create") {
      const res = await fetch(apiUrl("/api/links"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        alert("링크 생성에 실패했습니다.");
        console.error("POST /api/links failed:", res.status);
        return;
      }
      const created = (await res.json()) as LinkItem;
      const nextLinks = sortLinks([...state.links, created]);
      setState({
        links: nextLinks,
        panelMode: "closed",
        panelTargetId: null
      });
      return;
    }

    if (state.panelMode === "edit" && state.panelTargetId) {
      const id = state.panelTargetId;
      const res = await fetch(apiUrl(`/api/links/${encodeURIComponent(id)}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        alert("링크 수정에 실패했습니다.");
        console.error("PUT /api/links/:id failed:", res.status);
        return;
      }
      const updated = (await res.json()) as LinkItem;
      const nextLinks = sortLinks(
        state.links.map((l) => (l.id === updated.id ? updated : l))
      );
      setState({
        links: nextLinks,
        panelMode: "closed",
        panelTargetId: null
      });
      return;
    }
  } catch (err) {
    alert("서버 요청 중 오류가 발생했습니다.");
    console.error("handleSave error:", err);
  } finally {
    setState({ isSaving: false });
  }
}

async function handleDelete(
  state: AppState,
  setState: (patch: Partial<AppState>) => void
) {
  if (state.panelMode !== "edit" || !state.panelTargetId) return;
  const target = state.links.find((l) => l.id === state.panelTargetId);
  if (!target) return;

  const ok = window.confirm(
    `"${target.title}" 링크를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
  );
  if (!ok) return;

  setState({ isSaving: true });

  try {
    const res = await fetch(
      apiUrl(`/api/links/${encodeURIComponent(target.id)}`),
      {
        method: "DELETE"
      }
    );
    if (res.status !== 204) {
      alert("삭제에 실패했습니다.");
      console.error("DELETE /api/links/:id failed:", res.status);
      return;
    }
    const nextLinks = state.links.filter((l) => l.id !== target.id);
    setState({
      links: sortLinks(nextLinks),
      panelMode: "closed",
      panelTargetId: null
    });
  } catch (err) {
    alert("서버 요청 중 오류가 발생했습니다.");
    console.error("handleDelete error:", err);
  } finally {
    setState({ isSaving: false });
  }
}

function handleLogin(
  form: HTMLFormElement,
  setState: (patch: Partial<AppState>) => void
) {
  const fd = new FormData(form);
  const password = String(fd.get("password") ?? "");

  if (!password) {
    alert("비밀번호를 입력하세요.");
    return;
  }
  if (password !== ADMIN_PASSWORD) {
    alert("비밀번호가 올바르지 않습니다.");
    return;
  }

  try {
    window.localStorage.setItem(AUTH_KEY, "1");
  } catch {
    // ignore
  }

  setState({
    isAuthed: true,
    loginPanelOpen: false,
    backupPanelOpen: false
  });
}

// 드래그로 순서 재배치 (프론트 로컬)
function reorderLinksByDrag(
  list: LinkItem[],
  fromId: string,
  toId: string
): LinkItem[] {
  if (fromId === toId) return list;

  const from = list.find((l) => l.id === fromId);
  const to = list.find((l) => l.id === toId);
  if (!from || !to) return list;

  let groupFn: (l: LinkItem) => boolean;

  if (from.pinned) {
    if (!to.pinned) return list;
    groupFn = (l) => l.pinned;
  } else {
    if (to.pinned || from.category !== to.category) return list;
    const cat = from.category;
    groupFn = (l) => !l.pinned && l.category === cat;
  }

  const group = list
    .filter(groupFn)
    .sort((a, b) => {
      const ao = a.order ?? 0;
      const bo = b.order ?? 0;
      if (ao !== bo) return ao - bo;
      return (a.title || "").localeCompare(b.title || "", "ko");
    });

  const ids = group.map((l) => l.id);
  const fromIdx = ids.indexOf(fromId);
  const toIdx = ids.indexOf(toId);
  if (fromIdx === -1 || toIdx === -1) return list;

  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, fromId);

  const idToOrder = new Map<string, number>();
  ids.forEach((id, idx) => {
    idToOrder.set(id, (idx + 1) * 10);
  });

  const next = list.map((l) =>
    idToOrder.has(l.id) ? { ...l, order: idToOrder.get(l.id)! } : l
  );

  return sortLinks(next);
}

// 드래그 순서 서버 반영
async function syncReorderToServer(fromId: string, toId: string) {
  try {
    const res = await fetch(apiUrl("/api/links/reorder"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromId, toId })
    });
    if (!res.ok) {
      console.warn("Failed to sync reorder:", res.status);
    }
  } catch (err) {
    console.warn("Error syncing reorder:", err);
  }
}

// 서버 백업 import (비우기 포함)
async function syncBackupImport(
  links: LinkItem[],
  setState: (patch: Partial<AppState>) => void
) {
  try {
    const res = await fetch(apiUrl("/api/backup/import"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(links)
    });
    if (!res.ok) {
      alert("백업 복원에 실패했습니다.");
      console.error("POST /api/backup/import failed:", res.status);
      return;
    }
    setState({
      links: sortLinks(links),
      backupPanelOpen: false
    });
  } catch (err) {
    alert("서버 요청 중 오류가 발생했습니다.");
    console.error("syncBackupImport error:", err);
  }
}

// JSON 내보내기 (클라이언트에서 파일 다운로드)
function exportLinks(links: LinkItem[]) {
  try {
    const data = JSON.stringify(links, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jeongsite-links-backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("JSON 내보내기 중 오류가 발생했습니다.");
    console.error("exportLinks error:", err);
  }
}

// --------------------- 유틸 ---------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

function escapeHtmlTextArea(str: string): string {
  return escapeHtml(str);
}
