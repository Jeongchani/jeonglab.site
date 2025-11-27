// api/linksStore.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 기본 저장 위치: 환경변수 LINKS_FILE 있으면 그거, 없으면 ./data/links.json
export const LINKS_FILE =
  process.env.LINKS_FILE || path.join(__dirname, "data", "links.json");

const ALLOWED_CATEGORIES = ["Project", "Study", "Server", "Tool", "Docs", "Etc"];

// 파일에서 링크 목록 읽기
export async function readLinks() {
  try {
    const raw = await fs.readFile(LINKS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn("links.json is not an array. Returning [].");
      return [];
    }
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") {
      // 파일 없으면 빈 배열
      return [];
    }
    console.error("Error reading links.json:", err);
    throw err;
  }
}

// 링크 목록 전체를 파일에 쓰기
export async function writeLinks(links) {
  await fs.mkdir(path.dirname(LINKS_FILE), { recursive: true });
  const json = JSON.stringify(links, null, 2);
  await fs.writeFile(LINKS_FILE, json, "utf-8");
}

// 드래그 정렬 로직 (프론트랑 맞춰둔 버전)
export function reorderLinks(list, fromId, toId) {
  if (!fromId || !toId || fromId === toId) return list;

  const from = list.find((l) => l.id === fromId);
  const to = list.find((l) => l.id === toId);
  if (!from || !to) return list;

  let groupFn;

  if (from.pinned) {
    // pinned끼리만 이동
    if (!to.pinned) return list;
    groupFn = (l) => l.pinned;
  } else {
    // 일반 링크는 같은 category 안에서만 이동
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

  const idToOrder = new Map();
  ids.forEach((id, idx) => {
    idToOrder.set(id, (idx + 1) * 10);
  });

  const next = list.map((l) =>
    idToOrder.has(l.id) ? { ...l, order: idToOrder.get(l.id) } : l
  );

  return sortLinks(next);
}

// 프론트랑 맞춘 정렬 기준
export function sortLinks(list) {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    const ao = a.order ?? 0;
    const bo = b.order ?? 0;

    if (a.pinned && b.pinned) {
      if (ao !== bo) return ao - bo;
      return (a.title || "").localeCompare(b.title || "", "ko");
    }

    if (a.category !== b.category) {
      return (a.category || "").localeCompare(b.category || "");
    }
    if (ao !== bo) return ao - bo;
    return (a.title || "").localeCompare(b.title || "", "ko");
  });
}

// 제목 기반 ID 생성 (프론트랑 동일 로직)
export function generateId(title, existing) {
  const base =
    "link-" +
    String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

  const ids = new Set(existing.map((l) => l.id));
  if (!ids.has(base)) return base;

  let i = 2;
  while (ids.has(`${base}-${i}`)) {
    i++;
  }
  return `${base}-${i}`;
}

// category, visibility 간단 검증
export function normalizeCategory(raw) {
  if (ALLOWED_CATEGORIES.includes(raw)) return raw;
  return "Project";
}

export function normalizeVisibility(raw) {
  return raw === "private" ? "private" : "public";
}
