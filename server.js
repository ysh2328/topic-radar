import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 4177);
const ROOT = new URL(".", import.meta.url).pathname;
const PUBLIC_DIR = join(ROOT, "public");
const RUNTIME_DIR = join(ROOT, ".runtime");
const SNAPSHOT_PATH = join(RUNTIME_DIR, "snapshots.json");
const KIWI_SCRIPT = join(ROOT, "scripts", "tokenize_kiwi.py");
const PYTHON_BIN = process.env.TOPIC_RADAR_PYTHON || join(ROOT, ".venv", "bin", "python");
const USER_AGENT =
  "Mozilla/5.0 (compatible; TopicRadar/0.2; title-only trend index)";

const DEFAULT_SOURCE = process.env.TOPIC_RADAR_DEFAULT_SOURCE || "stockus";
const CACHE = new Map();

const SOURCES = {
  stockus: {
    id: "stockus",
    label: "stockus",
    title: "미주갤",
    kind: "dcinside",
    galleryId: "stockus",
    pages: 5,
    nodes: 60,
    refreshMs: 10 * 60 * 1000,
    href: "https://gall.dcinside.com/mgallery/board/lists/?id=stockus"
  },
  thesingularity: {
    id: "thesingularity",
    label: "thesingularity",
    title: "특이점",
    kind: "dcinside",
    galleryId: "thesingularity",
    pages: 3,
    nodes: 50,
    refreshMs: 15 * 60 * 1000,
    href: "https://gall.dcinside.com/mgallery/board/lists/?id=thesingularity"
  },
  ai_utilize: {
    id: "ai_utilize",
    label: "ai_utilize",
    title: "에활갤",
    kind: "dcinside",
    galleryId: "ai_utilize",
    pages: 3,
    nodes: 50,
    refreshMs: 10 * 60 * 1000,
    href: "https://m.dcinside.com/board/ai_utilize"
  },
  chanbiz: {
    id: "chanbiz",
    label: "4chan /biz/",
    title: "4chan /biz/",
    kind: "4chan",
    board: "biz",
    pages: 5,
    nodes: 40,
    refreshMs: 10 * 60 * 1000,
    href: "https://boards.4chan.org/biz/catalog"
  }
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const STOPWORDS = new Set(
  [
    "그리고", "그러나", "그래서", "그냥", "진짜", "근데", "이거", "저거", "그거",
    "이게", "저게", "그게", "내가", "너가", "니가", "나도", "너도", "우리",
    "오늘", "지금", "같은", "하는", "하면", "해서", "하고", "하고있", "하고있는",
    "했다", "있음", "있는", "없는", "있다", "된다", "아니", "왜", "뭐", "좀", "더",
    "너무", "이번", "다음", "여기", "저기", "링크", "영상", "사진", "정보",
    "공지", "개념글", "싱글벙글", "갤러리", "마이너", "댓글", "조회", "추천",
    "사람", "사람들", "생각", "이유", "절대", "사실", "언제", "많이", "원래",
    "필독", "계속", "추가", "예정", "뉴비", "가이드", "써야", "해요", "뭐에요",
    "특갤", "특붕", "특붕이", "일반", "뉴스", "질문", "리뷰", "운영자",
    "매니저", "부매니저", "등록순", "최신순", "전체", "ㅋㅋ", "ㅋㅋㅋ", "ㅎㅎ",
    "ㅠㅠ", "ㄹㅇ", "ㅈㄴ", "존나", "개", "됨", "함", "할", "해", "수", "나",
    "너", "저", "걍", "말", "큰", "제목", "게시판", "기준", "소량", "룰", "분류",
    "태그", "급상승", "상태", "완료", "수집", "키워드", "언급량", "대표", "떡밥",
    "관련", "근황", "후기", "뻘글", "잡담", "주식", "주가", "종목", "시장",
    "어떻게", "쓰는데", "되는데", "되는", "이제", "가장", "새로운", "웃긴거",
    "아님", "솔직히", "요즘", "그래", "내일", "떡", "밥", "중요", "이야기",
    "얘기", "정도", "소리", "갑자기", "님들", "되는거", "하는거", "있는거",
    "있는데", "없는데", "하는데", "되는데", "쓰는데", "같은데", "없냐", "있냐",
    "같냐", "하냐", "되냐", "하네", "되네", "하나", "하던데",
    "있", "내", "살", "함", "됨", "하", "구", "거", "것", "듯", "중", "전", "후",
    "the", "and", "for", "with", "from", "this", "that", "what", "when", "where",
    "why", "how", "are", "was", "were", "will", "would", "could", "should", "have",
    "has", "had", "you", "your", "they", "them", "their", "there", "here", "about",
    "just", "like", "into", "than", "then", "only", "still", "going", "thread",
    "general", "edition", "anonymous", "anon", "last", "time", "previous",
    "of", "to", "is", "it", "in", "get", "on", "all", "be", "as", "at", "by",
    "or", "if", "not", "but", "do", "does", "did", "can", "any", "who", "which",
    "over", "under", "more", "now", "out", "up", "down", "my", "me", "we", "our",
    "us", "he", "his", "she", "her", "its", "no", "yes", "so", "also", "one",
    "two", "new", "old", "some", "many", "much", "very", "really", "i'm", "im",
    "an", "don", "another", "business", "finance",
    "새끼", "병신", "씨발", "시발"
  ].map((word) => word.toLowerCase())
);

const BLOCKED_POST_PATTERN =
  /\b(nigg(?:er|a)|fag(?:got)?|kike|rape|raping|molest|loli|cp|kill yourself|kys|fuck(?:ing)?|creampies?|cum|porn|incest)\b/i;

const ALIASES = new Map([
  ["codex", "코덱스"],
  ["opencodex", "opencodex"],
  ["claude", "클로드"],
  ["gpt", "GPT"],
  ["chatgpt", "GPT"],
  ["gemini", "제미나이"],
  ["glm", "GLM"],
  ["kiro", "Kiro"],
  ["agi", "AGI"],
  ["ai", "AI"],
  ["llm", "LLM"],
  ["cli", "CLI"],
  ["ide", "IDE"],
  ["api", "API"],
  ["mcp", "MCP"],
  ["gpu", "GPU"],
  ["tsla", "TSLA"],
  ["nvda", "NVDA"],
  ["pltr", "PLTR"],
  ["rklb", "RKLB"],
  ["asts", "ASTS"],
  ["hood", "HOOD"],
  ["sofi", "SOFI"],
  ["soun", "SOUN"],
  ["zeta", "ZETA"]
]);

const EXACT_ALIASES = new Map([
  ["제미나", "제미나이"],
  ["제미나이", "제미나이"],
  ["코덱스", "코덱스"],
  ["클로드", "클로드"],
  ["오푸스", "오푸스"],
  ["그록", "그록"],
  ["엔비디아", "엔비디아"],
  ["테슬라", "테슬라"],
  ["비트", "비트코인"],
  ["비트코인", "비트코인"],
  ["마소", "MSFT"],
  ["하닉", "SK하이닉스"],
  ["엔비", "NVDA"]
]);

const KOREAN_SUFFIXES = [
  "이라는데", "라는데", "이라면서", "라면서", "이라니까", "라니까", "이라면",
  "이라서", "이었는데", "였는데", "했는데", "하는데", "되는데", "쓰는데",
  "같은데", "이었다", "였다", "입니다", "합니다", "한다", "했다", "된다",
  "되는", "하는", "같은", "라고", "라는", "이고", "이며", "이면", "에서",
  "에게", "한테", "부터", "까지", "보다", "처럼", "마다", "으로", "하고",
  "이랑", "이나", "거나", "든가", "밖에", "조차", "마저", "인데", "는데",
  "은데", "서", "은", "는", "이", "가", "을", "를", "에", "도", "만", "로",
  "와", "과", "랑"
].sort((a, b) => b.length - a.length);

const TRAILING_COMPOUNDS = [
  "떡밥", "관련", "근황", "후기", "질문", "정보", "뉴스", "글", "글들"
];

function htmlDecode(value = "") {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value = "") {
  return htmlDecode(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractCell(rowHtml, className) {
  const pattern = new RegExp(`<td[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/td>`, "i");
  const match = rowHtml.match(pattern);
  return match ? match[1] : "";
}

function absoluteDcUrl(href) {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `https://gall.dcinside.com${href}`;
  return `https://gall.dcinside.com/${href}`;
}

function parseRows(html, galleryId) {
  const rows = html.match(/<tr[^>]*class=["'][^"']*ub-content[^"']*["'][\s\S]*?<\/tr>/gi) || [];
  const posts = [];

  for (const row of rows) {
    const subject = stripTags(extractCell(row, "gall_subject"));
    const dataType = row.match(/data-type=["']([^"']+)["']/i)?.[1] || "";
    const dataNo = row.match(/data-no=["']([^"']+)["']/i)?.[1] || "";
    const titleCell = extractCell(row, "gall_tit");
    const linkMatch = titleCell.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const title = stripTags(linkMatch?.[2] || titleCell);
    const href = linkMatch?.[1] || "";
    const url = absoluteDcUrl(href);
    const dateCell = extractCell(row, "gall_date");
    const dateTitle = dateCell.match(/title=["']([^"']+)["']/i)?.[1] || "";
    const date = dateTitle || stripTags(dateCell);
    const views = Number(stripTags(extractCell(row, "gall_count")).replace(/[^\d]/g, "")) || 0;
    const reco = Number(stripTags(extractCell(row, "gall_recommend")).replace(/[^\d]/g, "")) || 0;

    if (!title || !url.includes("/board/view/")) continue;
    if (subject.includes("공지") || subject.includes("설문") || dataType.includes("notice")) continue;
    if (/통합 공지|신문고|용어 모음집|뉴비 가이드|필독/.test(title)) continue;

    posts.push({
      id: dataNo || `${galleryId}-${posts.length}`,
      source: "dcinside",
      galleryId,
      subject,
      title,
      url,
      date,
      views,
      reco
    });
  }

  return posts;
}

function shortPreview(value = "", maxLength = 180) {
  const cleaned = stripTags(value)
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/>>\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function absoluteFourChanUrl(board, threadNo) {
  return `https://boards.4chan.org/${encodeURIComponent(board)}/thread/${encodeURIComponent(threadNo)}`;
}

function parseFourChanCatalog(catalog, board) {
  const posts = [];
  const pages = Array.isArray(catalog) ? catalog : [];

  for (const page of pages) {
    const threads = Array.isArray(page?.threads) ? page.threads : [];
    for (const thread of threads) {
      const no = String(thread?.no || "");
      if (!no) continue;
      if (thread.sticky) continue;

      const subject = shortPreview(thread.sub || "");
      const bodyPreview = shortPreview(thread.com || "");
      const title = subject || bodyPreview;
      if (!title) continue;
      if (BLOCKED_POST_PATTERN.test(title) || BLOCKED_POST_PATTERN.test(bodyPreview)) continue;

      const timeMs = Number(thread.time || thread.last_modified || 0) * 1000;
      const date = timeMs
        ? new Intl.DateTimeFormat("ko-KR", {
            hour: "2-digit",
            minute: "2-digit"
          }).format(new Date(timeMs))
        : "-";

      posts.push({
        id: `${board}-${no}`,
        source: "4chan",
        board,
        subject: subject || "thread",
        title,
        url: absoluteFourChanUrl(board, no),
        date,
        views: Number(thread.replies || 0),
        reco: Number(thread.images || 0),
        replies: Number(thread.replies || 0),
        images: Number(thread.images || 0)
      });
    }
  }

  return posts;
}

function stripKoreanSuffixes(token) {
  let value = token;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = KOREAN_SUFFIXES.find((suffix) => value.length > suffix.length + 1 && value.endsWith(suffix));
    if (!next) break;
    value = value.slice(0, -next.length);
  }
  return value;
}

function stripCompoundTail(token) {
  for (const tail of TRAILING_COMPOUNDS) {
    if (token.length > tail.length + 1 && token.endsWith(tail)) return token.slice(0, -tail.length);
  }
  return token;
}

function normalizeToken(raw) {
  let token = raw.trim().replace(/[~!?,.]+$/g, "");
  if (!token) return "";

  const hadCashtag = token.startsWith("$");
  token = token.replace(/^[$#@]+/, "");
  if (!token) return "";

  if (EXACT_ALIASES.has(token)) return EXACT_ALIASES.get(token);
  const lower = token.toLowerCase();
  if (ALIASES.has(lower)) return ALIASES.get(lower);

  if (/^[a-z][a-z0-9._-]{1,9}$/i.test(token)) {
    if (hadCashtag || token.length <= 5) return token.toUpperCase();
    return lower;
  }

  if (/^[0-9]+(\.[0-9]+)+$/.test(token)) return token;

  if (/^[가-힣]{2,}$/.test(token)) {
    token = stripKoreanSuffixes(token);
    token = stripCompoundTail(token);
    token = stripKoreanSuffixes(token);
  }

  return token;
}

function filterTokens(rawTokens) {
  const tokens = [];
  const seen = new Set();
  for (const raw of rawTokens) {
    const token = normalizeToken(String(raw));
    if (!token) continue;
    const key = token.toLowerCase();
    if (STOPWORDS.has(key)) continue;
    if (/^\d+$/.test(token)) continue;
    if (/^[가-힣]$/.test(token)) continue;
    if (token.length < 2 && !/^[A-Z]$/.test(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens.slice(0, 12);
}

function tokenize(title) {
  const cleaned = title
    .replace(/\[[^\]]+]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^0-9A-Za-z가-힣$#@_+.-]+/g, " ");
  return filterTokens(cleaned.split(/\s+/));
}

function runKiwi(titles) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [KIWI_SCRIPT], {
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Kiwi tokenizer timed out"));
    }, 15000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Kiwi tokenizer exited ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(titles));
  });
}

async function attachTokens(posts) {
  try {
    const titleTokens = await runKiwi(posts.map((post) => post.title));
    if (!Array.isArray(titleTokens) || titleTokens.length !== posts.length) {
      throw new Error("Kiwi tokenizer returned invalid shape");
    }
    return {
      tokenizer: "kiwi",
      posts: posts.map((post, index) => ({
        ...post,
        tokens: filterTokens(Array.isArray(titleTokens[index]) ? titleTokens[index] : [])
      }))
    };
  } catch (error) {
    console.error(`[Topic Radar] Kiwi fallback: ${error.message}`);
    return {
      tokenizer: "fallback",
      posts: posts.map((post) => ({ ...post, tokens: tokenize(post.title) }))
    };
  }
}

async function readSnapshotStore() {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function writeSnapshotStore(store) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(SNAPSHOT_PATH, JSON.stringify(store, null, 2));
}

function latestSnapshot(store, sourceId) {
  const list = store[sourceId];
  return Array.isArray(list) && list.length ? list[list.length - 1] : null;
}

async function saveSnapshot(store, sourceId, terms, totalPosts) {
  const compactCounts = {};
  for (const term of terms.slice(0, 120)) compactCounts[term.term] = term.count;
  const list = Array.isArray(store[sourceId]) ? store[sourceId] : [];
  list.push({
    at: new Date().toISOString(),
    totalPosts,
    counts: compactCounts
  });
  store[sourceId] = list.slice(-96);
  await writeSnapshotStore(store);
}

function isRisingSignal(count, previousCount, delta, growthRate) {
  if (previousCount === null || delta === null || delta <= 0) return false;
  if (previousCount === 0) return count >= 4;
  if (delta >= 3) return true;
  return delta >= 2 && growthRate !== null && growthRate >= 1 && count >= 6;
}

function analyze(posts, source, previousSnapshot = null, tokenizer = "fallback") {
  const nodeMap = new Map();
  const linkMap = new Map();
  const titleTokens = [];

  for (const post of posts) {
    const tokens = Array.isArray(post.tokens) ? post.tokens : tokenize(post.title);
    titleTokens.push({ post, tokens });
    for (const token of tokens) {
      const node = nodeMap.get(token) || {
        id: token,
        term: token,
        label: token,
        count: 0,
        views: 0,
        reco: 0,
        posts: []
      };
      node.count += 1;
      node.views += post.views || 0;
      node.reco += post.reco || 0;
      if (node.posts.length < 6) node.posts.push(post);
      nodeMap.set(token, node);
    }
  }

  const previousCounts = previousSnapshot?.counts || {};
  const previousTotalPosts = previousSnapshot?.totalPosts || 0;
  const maxNodes = source.nodes;
  const terms = [...nodeMap.values()]
    .sort((a, b) => b.count - a.count || b.reco - a.reco || b.views - a.views)
    .slice(0, maxNodes)
    .map((term, index) => {
      const previousCount = previousCounts[term.term] ?? null;
      const delta = previousCount === null ? null : term.count - previousCount;
      const growthRate = previousCount && previousCount > 0 ? delta / previousCount : null;
      const newTermLift = previousCount === 0 || previousCount === null ? term.count : 0;
      const growthScore =
        previousCount === null
          ? null
          : Math.max(0, delta) + (growthRate && growthRate > 0 ? Math.min(4, growthRate) : 0) + newTermLift * 0.35;
      const rising = isRisingSignal(term.count, previousCount, delta, growthRate);
      let heat = "normal";
      if (index < 3 && term.count >= 3) heat = "hot";
      if (rising) heat = "rising";
      return {
        ...term,
        id: term.term,
        rank: index + 1,
        previousCount,
        delta,
        growthRate,
        growthScore,
        rising,
        heat,
        relatedTerms: []
      };
    });
  const keep = new Set(terms.map((node) => node.id));

  for (const { tokens } of titleTokens) {
    const kept = tokens.filter((token) => keep.has(token));
    for (let i = 0; i < kept.length; i += 1) {
      for (let j = i + 1; j < kept.length; j += 1) {
        const a = kept[i] < kept[j] ? kept[i] : kept[j];
        const b = kept[i] < kept[j] ? kept[j] : kept[i];
        const key = `${a}|||${b}`;
        const link = linkMap.get(key) || { source: a, target: b, count: 0 };
        link.count += 1;
        linkMap.set(key, link);
      }
    }
  }

  const links = [...linkMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(120, maxNodes * 3));

  const termById = new Map(terms.map((term) => [term.term, term]));
  for (const link of links) {
    const sourceTerm = termById.get(link.source);
    const targetTerm = termById.get(link.target);
    if (sourceTerm) sourceTerm.relatedTerms.push({ term: link.target, count: link.count });
    if (targetTerm) targetTerm.relatedTerms.push({ term: link.source, count: link.count });
  }
  for (const term of terms) {
    term.relatedTerms = term.relatedTerms.sort((a, b) => b.count - a.count).slice(0, 8);
  }

  const risingTerms = terms
    .filter((term) => term.rising)
    .sort((a, b) => b.growthScore - a.growthScore || b.count - a.count)
    .slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    source: {
      id: source.id,
      label: source.label,
      title: source.title,
      href: source.href,
      pages: source.pages,
      refreshMs: source.refreshMs
    },
    sources: Object.values(SOURCES).map(({ id, label, title, href }) => ({ id, label, title, href })),
    totalPosts: posts.length,
    terms,
    topTerms: terms.slice(0, 24),
    risingTerms,
    nodes: terms,
    links,
    posts: posts.slice(0, 80),
    tags: [],
    stats: {
      totalPosts: posts.length,
      termCount: terms.length,
      linkCount: links.length,
      previousAt: previousSnapshot?.at || null,
      previousTotalPosts,
      comparisonReady: Boolean(previousSnapshot),
      tokenizer,
      cached: false,
      refreshing: false
    }
  };
}

async function fetchGallery(galleryId, pages) {
  const safeId = String(galleryId || "thesingularity").replace(/[^a-zA-Z0-9_]/g, "");
  const pageCount = Math.max(1, Math.min(Number(pages) || 3, 10));
  const posts = [];
  const seen = new Set();

  for (let page = 1; page <= pageCount; page += 1) {
    const url = `https://gall.dcinside.com/mgallery/board/lists/?id=${encodeURIComponent(safeId)}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6"
      }
    });
    if (!res.ok) throw new Error(`Fetch failed ${res.status} for page ${page}`);
    const html = await res.text();
    for (const post of parseRows(html, safeId)) {
      const key = post.id || post.url || post.title;
      if (seen.has(key)) continue;
      seen.add(key);
      posts.push(post);
    }
    if (page < pageCount) await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return posts;
}

async function fetchFourChanBoard(board, pages) {
  const safeBoard = String(board || "biz").replace(/[^a-zA-Z0-9_]/g, "");
  const pageCount = Math.max(1, Math.min(Number(pages) || 1, 15));
  const url = `https://a.4cdn.org/${encodeURIComponent(safeBoard)}/catalog.json`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json"
    }
  });
  if (!res.ok) throw new Error(`4chan fetch failed ${res.status} for /${safeBoard}/`);
  const catalog = await res.json();
  return parseFourChanCatalog(Array.isArray(catalog) ? catalog.slice(0, pageCount) : [], safeBoard);
}

async function fetchPostsForSource(source) {
  if (source.kind === "4chan") return fetchFourChanBoard(source.board, source.pages);
  return fetchGallery(source.galleryId, source.pages);
}

async function refreshSource(sourceId) {
  const source = SOURCES[sourceId] || SOURCES[DEFAULT_SOURCE];
  const current = CACHE.get(source.id);
  if (current?.refreshPromise) return current.refreshPromise;

  const refreshPromise = (async () => {
    const posts = await fetchPostsForSource(source);
    const tokenized = await attachTokens(posts);
    const store = await readSnapshotStore();
    const previous = latestSnapshot(store, source.id);
    const analyzed = analyze(tokenized.posts, source, previous, tokenized.tokenizer);
    await saveSnapshot(store, source.id, analyzed.terms, posts.length);
    CACHE.set(source.id, {
      data: analyzed,
      fetchedAt: Date.now(),
      error: null,
      refreshPromise: null
    });
    return analyzed;
  })();

  CACHE.set(source.id, {
    data: current?.data || null,
    fetchedAt: current?.fetchedAt || 0,
    error: null,
    refreshPromise
  });

  try {
    return await refreshPromise;
  } catch (error) {
    CACHE.set(source.id, {
      data: current?.data || null,
      fetchedAt: current?.fetchedAt || 0,
      error,
      refreshPromise: null
    });
    throw error;
  }
}

async function getRadar(sourceId, force = false) {
  const source = SOURCES[sourceId] || SOURCES[DEFAULT_SOURCE];
  const current = CACHE.get(source.id);
  const stale = !current?.fetchedAt || Date.now() - current.fetchedAt > source.refreshMs;

  if (!force && current?.data && !stale) {
    return withCacheStats(current.data, current.fetchedAt, false);
  }

  if (!force && current?.data && stale) {
    refreshSource(source.id).catch((error) => {
      console.error(`[Topic Radar] background refresh failed for ${source.id}:`, error.message);
    });
    return withCacheStats(current.data, current.fetchedAt, true);
  }

  const fresh = await refreshSource(source.id);
  return withCacheStats(fresh, Date.now(), false);
}

function withCacheStats(data, fetchedAt, refreshing) {
  return {
    ...data,
    stats: {
      ...data.stats,
      cached: true,
      refreshing,
      fetchedAt: new Date(fetchedAt).toISOString(),
      nextRefreshAt: new Date(fetchedAt + data.source.refreshMs).toISOString()
    }
  };
}

async function handleApi(req, res, url) {
  try {
    const id = url.searchParams.get("source") || url.searchParams.get("id") || DEFAULT_SOURCE;
    const force = url.searchParams.get("refresh") === "1";
    const analyzed = await getRadar(id, force);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(JSON.stringify(analyzed));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error.message }));
  }
}

async function handleStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/chaos") {
    res.writeHead(302, { Location: "/" });
    res.end();
    return;
  }
  if (
    pathname === "/" ||
    pathname === "/clean" ||
    pathname === "/thesingularity" ||
    pathname === "/singularaty" ||
    pathname === "/singularity" ||
    pathname === "/ai_utilize" ||
    pathname === "/ai" ||
    pathname === "/4chan" ||
    pathname === "/biz" ||
    pathname === "/chanbiz"
  ) {
    pathname = "/index.html";
  }
  const filePath = normalize(join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] || "application/octet-stream"
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname === "/api/radar") {
    await handleApi(req, res, url);
    return;
  }
  await handleStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Topic Radar running at http://localhost:${PORT}`);
  refreshSource(DEFAULT_SOURCE).catch((error) => {
    console.error(`[Topic Radar] warmup failed:`, error.message);
  });
});

setInterval(() => {
  for (const source of Object.values(SOURCES)) {
    const current = CACHE.get(source.id);
    if (!current?.data) continue;
    if (Date.now() - current.fetchedAt > source.refreshMs) {
      refreshSource(source.id).catch((error) => {
        console.error(`[Topic Radar] scheduled refresh failed for ${source.id}:`, error.message);
      });
    }
  }
}, 60 * 1000).unref();
