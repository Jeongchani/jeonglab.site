// api/server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  readLinks,
  writeLinks,
  reorderLinks,
  sortLinks,
  generateId,
  normalizeCategory,
  normalizeVisibility
} from "./linksStore.js";

const app = express();
const PORT = process.env.PORT || 4000;

// __dirname 계산 (ESM용)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 컨테이너 안에서 정적 파일 루트
// 환경변수 WEB_ROOT 없으면 기본값은 ./public
const WEB_ROOT = process.env.WEB_ROOT || path.join(__dirname, "public");

// 필요하면 나중에 origin 제한하면 됨. 지금은 dev 편하게 전체 허용.
app.use(cors());
app.use(express.json());

// 정적 파일 서빙
app.use(express.static(WEB_ROOT));

// 루트(/)는 index.html 반환
app.get("/", (req, res) => {
  res.sendFile(path.join(WEB_ROOT, "index.html"));
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// 모든 링크 조회
app.get("/api/links", async (req, res, next) => {
  try {
    const links = await readLinks();
    res.json(sortLinks(links));
  } catch (err) {
    next(err);
  }
});

// 링크 생성
app.post("/api/links", async (req, res, next) => {
  try {
    const body = req.body || {};
    const title = String(body.title || "").trim();
    const url = String(body.url || "").trim();
    const category = normalizeCategory(String(body.category || "Project"));
    const icon = String(body.icon || "").trim() || "emoji:🔗";
    const notes = String(body.notes || "").trim() || undefined;
    const pinned = Boolean(body.pinned);
    const visibility = normalizeVisibility(body.visibility);
    const orderRaw = body.order;
    const order =
      typeof orderRaw === "number" && !Number.isNaN(orderRaw)
        ? orderRaw
        : undefined;

    if (!title || !url) {
      return res.status(400).json({ error: "title and url are required" });
    }

    const now = new Date().toISOString();
    const links = await readLinks();
    const id = generateId(title, links);

    const maxOrder =
      links.length > 0
        ? Math.max(...links.map((l) => l.order ?? 0))
        : 0;

    const link = {
      id,
      title,
      url,
      icon,
      category,
      pinned,
      notes,
      order: order ?? maxOrder + 10,
      createdAt: now,
      updatedAt: now,
      visibility
    };

    const nextLinks = sortLinks([...links, link]);
    await writeLinks(nextLinks);
    res.status(201).json(link);
  } catch (err) {
    next(err);
  }
});

// 링크 수정
app.put("/api/links/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = req.body || {};

    const links = await readLinks();
    const idx = links.findIndex((l) => l.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "link not found" });
    }

    const current = links[idx];

    const title =
      "title" in body
        ? String(body.title || "").trim()
        : current.title;
    const url =
      "url" in body ? String(body.url || "").trim() : current.url;

    if (!title || !url) {
      return res.status(400).json({ error: "title and url are required" });
    }

    const category =
      "category" in body
        ? normalizeCategory(String(body.category || current.category))
        : current.category;

    const icon =
      "icon" in body
        ? String(body.icon || current.icon || "emoji:🔗").trim()
        : current.icon || "emoji:🔗";

    const notes =
      "notes" in body
        ? (String(body.notes || "").trim() || undefined)
        : current.notes;

    const pinned =
      "pinned" in body ? Boolean(body.pinned) : Boolean(current.pinned);

    const visibility =
      "visibility" in body
        ? normalizeVisibility(body.visibility)
        : normalizeVisibility(current.visibility);

    let order = current.order;
    if ("order" in body) {
      const raw = body.order;
      if (typeof raw === "number" && !Number.isNaN(raw)) {
        order = raw;
      }
    }

    const now = new Date().toISOString();

    const updated = {
      ...current,
      title,
      url,
      category,
      icon,
      notes,
      pinned,
      visibility,
      order,
      updatedAt: now
    };

    const nextLinks = sortLinks(
      links.map((l, i) => (i === idx ? updated : l))
    );

    await writeLinks(nextLinks);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// 링크 삭제
app.delete("/api/links/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const links = await readLinks();
    const exists = links.some((l) => l.id === id);
    if (!exists) {
      return res.status(404).json({ error: "link not found" });
    }
    const nextLinks = links.filter((l) => l.id !== id);
    await writeLinks(nextLinks);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// 드래그 정렬 반영
app.post("/api/links/reorder", async (req, res, next) => {
  try {
    const body = req.body || {};
    const fromId = String(body.fromId || "");
    const toId = String(body.toId || "");
    if (!fromId || !toId) {
      return res
        .status(400)
        .json({ error: "fromId and toId are required" });
    }

    const links = await readLinks();
    const nextLinks = reorderLinks(links, fromId, toId);
    await writeLinks(nextLinks);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// (옵션) 백업용 엔드포인트 – 나중에 프론트에서 쓸 수도 있음
app.get("/api/backup/export", async (req, res, next) => {
  try {
    const links = await readLinks();
    res.json(links);
  } catch (err) {
    next(err);
  }
});

app.post("/api/backup/import", async (req, res, next) => {
  try {
    const body = req.body;
    if (!Array.isArray(body)) {
      return res
        .status(400)
        .json({ error: "request body must be an array" });
    }
    const links = sortLinks(body);
    await writeLinks(links);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ error: "internal server error" });
});

app.listen(PORT, () => {
  console.log(`jeong.site API listening on http://localhost:${PORT}`);
});