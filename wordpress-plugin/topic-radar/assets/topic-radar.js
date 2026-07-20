const statusTextEl = document.querySelector("#statusText");
const updatedAtEl = document.querySelector("#updatedAt");
const pageTitleEl = document.querySelector(".topbar h1");
const wordCloudEl = document.querySelector("#wordCloud");
const primaryLabelEl = document.querySelector("#primaryLabel");
const selectedTermEl = document.querySelector("#selectedTerm");
const selectedMetaEl = document.querySelector("#selectedMeta");
const relatedTermsEl = document.querySelector("#relatedTerms");
const selectedPostsEl = document.querySelector("#selectedPosts");
const sourceBoardEl = document.querySelector(".source-board");
const secondaryColumnEl = document.querySelector("#secondaryColumn");
const secondaryCloudEl = document.querySelector("#secondaryCloud");
const secondaryLabelEl = document.querySelector("#secondaryLabel");
const primaryRisingLabelEl = document.querySelector("#primaryRisingLabel");
const primaryRisingListEl = document.querySelector("#primaryRisingList");
const secondaryRisingColumnEl = document.querySelector("#secondaryRisingColumn");
const secondaryRisingLabelEl = document.querySelector("#secondaryRisingLabel");
const secondaryRisingListEl = document.querySelector("#secondaryRisingList");
const detailDrawerEl = document.querySelector("#detailDrawer");
const detailCloseEl = document.querySelector("#detailClose");
const inlineDetailQuery = window.matchMedia("(min-width: 721px)");

let radarData = null;
let secondaryRadarData = null;
let selectedTerm = null;
let selectedSourceId = null;

const params = new URLSearchParams(location.search);
const cleanPath = location.pathname.replace(/\/+$/, "");
const pathSource =
  ["/thesingularity", "/singularaty", "/singularity"].includes(cleanPath)
    ? "thesingularity"
    : cleanPath === "/agent_stack"
      ? "agent_stack"
    : ["/4chan", "/biz", "/chanbiz"].includes(cleanPath)
      ? "chanbiz"
      : "";
const explicitSource = params.get("source") || params.get("id") || pathSource;
let activeSource = explicitSource || "stockus";
const secondarySource = explicitSource ? "" : "chanbiz";
const DISPLAY_STOPWORDS = new Set([
  "살", "내", "있", "하", "구", "함", "됨", "거", "것", "수", "듯", "중", "전", "후",
  "왜", "뭐", "좀", "더", "말", "나", "너", "저", "걍", "그냥", "진짜", "근데",
  "오늘", "지금", "이번", "다음", "요즘", "갑자기", "님들", "어떻게", "이게",
  "저게", "그게", "내가", "너가", "니가", "우리", "같은", "하는", "하면", "해서",
  "하고", "했다", "있는", "없는", "있음", "있다", "된다", "되는", "되는거",
  "하는거", "있는거", "있는데", "없는데", "하는데", "되는데", "쓰는데", "같은데",
  "없냐", "있냐", "같냐", "하냐", "되냐", "하네", "되네", "하나", "하던데",
  "아니", "아님", "이제", "관련", "근황", "후기", "질문", "정보",
  "뉴스", "글", "글들", "주식", "주가", "종목", "시장", "떡밥", "사람", "생각",
  "이유", "정도", "얘기", "이야기", "소리", "새끼", "병신", "씨발", "시발"
]);

detailCloseEl?.addEventListener("click", () => {
  closeDetail();
});

inlineDetailQuery.addEventListener?.("change", () => {
  syncDetailPresentation();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !isInlineDetailMode()) closeDetail();
});

document.addEventListener("pointerdown", (event) => {
  if (!isDetailOpen()) return;
  if (isInlineDetailMode()) return;
  const target = event.target;
  if (detailDrawerEl?.contains(target)) return;
  if (target.closest?.(".cloud-word, .rank-item, .related-chip, button, a, input, select, textarea")) return;
  closeDetail();
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function formatDelta(term) {
  if (term.delta > 0) return `+${term.delta}`;
  return "";
}

function formatTime(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function cloudTier(index) {
  if (index === 0) return 1;
  if (index < 3) return 2;
  if (index < 7) return 3;
  if (index < 14) return 4;
  if (index < 26) return 5;
  return 6;
}

function sourceTermLimit(data = radarData) {
  const sourceId = data?.source?.id || activeSource;
  if (sourceId === "chanbiz") return secondarySource ? 12 : 24;
  return ["thesingularity", "agent_stack"].includes(sourceId) ? 50 : 12;
}

function sourceLabel(data) {
  const sourceId = data?.source?.id || "";
  if (sourceId === "stockus") return "미주갤";
  if (sourceId === "chanbiz") return "4chan /biz/";
  if (sourceId === "thesingularity") return "특갤";
  if (sourceId === "agent_stack") return "에스";
  return data?.source?.title || data?.source?.label || sourceId || "source";
}

function pageTitle(data) {
  if (secondarySource) return "티커는지금";
  if (data?.source?.id === "thesingularity") return "특갤은지금";
  if (data?.source?.id === "agent_stack") return "에스는지금";
  if (data?.source?.id === "chanbiz") return "지금4chan은";
  return "티커는지금";
}

function termText(term) {
  return String(term?.term || term || "").trim();
}

function isDisplayTerm(term) {
  const text = termText(term);
  if (!text) return false;
  const key = text.toLowerCase();
  if (DISPLAY_STOPWORDS.has(text) || DISPLAY_STOPWORDS.has(key)) return false;
  if (/^[가-힣]$/.test(text)) return false;
  if (/^\d+$/.test(text)) return false;
  return true;
}

function isVisibleForSource(term, data = radarData) {
  if (!isDisplayTerm(term)) return false;
  if (["thesingularity", "agent_stack"].includes(data?.source?.id)) {
    return Number(term?.count || 0) >= 3;
  }
  return true;
}

function visibleTerms(data = radarData) {
  return (data?.terms || []).filter((term) => isVisibleForSource(term, data)).slice(0, sourceTermLimit(data));
}

function visibleTopTerms(data = radarData) {
  return (data?.topTerms || data?.terms || [])
    .filter((term) => isVisibleForSource(term, data))
    .slice(0, sourceTermLimit(data));
}

function setStatus(text) {
  statusTextEl.textContent = text;
}

function renderSources(data) {
  const sources = data.sources || [];
  const source = data.source || sources.find((item) => item.id === activeSource) || {};
  activeSource = source.id || activeSource;
  document.body.dataset.source = activeSource;
  document.body.dataset.layout = secondarySource ? "dual" : "single";
  sourceBoardEl?.classList.toggle("has-secondary", Boolean(secondarySource));
  const title = pageTitle({ source });
  if (pageTitleEl) pageTitleEl.textContent = title;
  document.title = title;
  if (primaryLabelEl) primaryLabelEl.textContent = sourceLabel(data);
  if (primaryRisingLabelEl) primaryRisingLabelEl.textContent = sourceLabel(data);
  if (secondaryColumnEl) secondaryColumnEl.hidden = !secondarySource;
  if (secondaryRisingColumnEl) secondaryRisingColumnEl.hidden = !secondarySource;
}

function renderAll(data) {
  const previousTerm = selectedTerm?.term || "";
  radarData = data;

  renderSources(data);
  const terms = visibleTerms(data);
  if (selectedSourceId === data.source?.id) {
    selectedTerm = terms.find((term) => term.term === previousTerm) || null;
  }
  if (isInlineDetailMode() && (!selectedTerm || selectedSourceId !== data.source?.id)) {
    selectedTerm = terms[0] || null;
    selectedSourceId = selectedTerm ? data.source?.id || activeSource : null;
  }
  updatedAtEl.textContent = `${formatTime(data.stats?.fetchedAt || data.generatedAt)} · ${data.source?.pages || "-"}p`;
  setStatus(data.stats?.refreshing ? "updating" : "live");

  renderCloud(terms, wordCloudEl, data);
  syncDetailPresentation();
  if (!selectedTerm && !isInlineDetailMode()) closeDetail();
  if (isDetailOpen()) renderSelected(selectedTerm, selectedData());
  renderRisingForDataSets([data, secondaryRadarData].filter(Boolean));
}

function renderSecondary(data) {
  secondaryRadarData = data;
  if (secondaryLabelEl) secondaryLabelEl.textContent = sourceLabel(data);
  if (secondaryRisingLabelEl) secondaryRisingLabelEl.textContent = sourceLabel(data);
  if (selectedSourceId === data.source?.id) {
    const previousTerm = selectedTerm?.term || "";
    selectedTerm = visibleTerms(data).find((term) => term.term === previousTerm) || null;
  }
  renderCloud(visibleTerms(data), secondaryCloudEl, data);
  if (!selectedTerm) closeDetail();
  if (isDetailOpen()) renderSelected(selectedTerm, selectedData());
  renderRisingForDataSets([radarData, data].filter(Boolean));
}

function renderCloud(terms, container = wordCloudEl, data = radarData) {
  if (!container) return;
  container.innerHTML = "";
  if (!terms.length) {
    container.innerHTML = `<div class="loading-card">no words</div>`;
    return;
  }

  for (const [index, term] of terms.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "cloud-word",
      `tier-${cloudTier(index)}`,
      `heat-${term.heat || "normal"}`,
      selectedTerm?.term === term.term && selectedSourceId === data?.source?.id ? "selected" : ""
    ].join(" ");
    button.style.setProperty("--tilt", `${((index % 7) - 3) * 0.65}deg`);
    button.innerHTML = `
      <span class="word-label">${escapeHtml(term.term)}</span>
      <span class="word-meta">${formatNumber(term.count)} mentions${term.heat === "rising" && formatDelta(term) ? ` / ${formatDelta(term)}` : ""}</span>
    `;
    button.addEventListener("click", () => selectTerm(term, data));
    container.append(button);
  }
}

function selectTerm(term, data = radarData) {
  selectedTerm = term;
  selectedSourceId = data?.source?.id || activeSource;
  renderCloud(visibleTerms(radarData), wordCloudEl, radarData);
  if (secondaryRadarData) {
    renderCloud(visibleTerms(secondaryRadarData), secondaryCloudEl, secondaryRadarData);
  }
  openDetail();
  renderSelected(term, data);
}

function isDetailOpen() {
  return detailDrawerEl && !detailDrawerEl.hidden;
}

function isInlineDetailMode() {
  return !secondarySource && inlineDetailQuery.matches;
}

function syncDetailPresentation() {
  if (!detailDrawerEl) return;
  if (isInlineDetailMode()) {
    detailDrawerEl.hidden = false;
    if (!selectedTerm) renderSelected(null, selectedData());
    return;
  }
  if (!selectedTerm) detailDrawerEl.hidden = true;
}

function openDetail() {
  if (detailDrawerEl) detailDrawerEl.hidden = false;
}

function closeDetail() {
  if (detailDrawerEl) detailDrawerEl.hidden = !isInlineDetailMode();
  selectedTerm = null;
  selectedSourceId = null;
  if (radarData) {
    renderCloud(visibleTerms(radarData), wordCloudEl, radarData);
  }
  if (secondaryRadarData) {
    renderCloud(visibleTerms(secondaryRadarData), secondaryCloudEl, secondaryRadarData);
  }
  if (isInlineDetailMode()) renderSelected(null, selectedData());
}

function selectedData() {
  if (selectedSourceId && secondaryRadarData?.source?.id === selectedSourceId) return secondaryRadarData;
  return radarData;
}

function renderSelected(term, data = selectedData()) {
  if (!term) {
    selectedTermEl.textContent = "대기중";
    selectedMetaEl.textContent = "단어를 누르세요";
    relatedTermsEl.innerHTML = "";
    selectedPostsEl.innerHTML = `<div class="empty-note">아직 찍은 단어 없음</div>`;
    return;
  }

  selectedTermEl.textContent = term.term;
  selectedMetaEl.textContent = `${formatNumber(term.count)} mentions${formatDelta(term) ? ` · ${formatDelta(term)}` : ""}`;

  relatedTermsEl.innerHTML = "";
  for (const related of (term.relatedTerms || []).filter(isDisplayTerm)) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "related-chip";
    chip.textContent = `${related.term} ${related.count}`;
    chip.addEventListener("click", () => {
      const next = data?.terms?.find((item) => item.term === related.term && isDisplayTerm(item));
      if (next) selectTerm(next, data);
    });
    relatedTermsEl.append(chip);
  }

  selectedPostsEl.innerHTML = "";
  const posts = term.posts || [];
  if (!posts.length) {
    selectedPostsEl.innerHTML = `<div class="empty-note">no titles</div>`;
    return;
  }
  for (const post of posts.slice(0, 5)) selectedPostsEl.append(postElement(post));
}

function renderRisingList(data, container) {
  if (!container) return;
  container.innerHTML = "";
  const comparisonReady = data?.stats?.comparisonReady;
  const terms = data?.risingTerms || [];
  if (!comparisonReady) {
    container.innerHTML = `<div class="empty-note">비교 준비 중</div>`;
    return;
  }
  const displayTerms = terms.filter((term) => isVisibleForSource(term, data));
  if (!displayTerms.length) {
    container.innerHTML = `<div class="empty-note">뚜렷한 변화 없음</div>`;
    return;
  }
  for (const term of displayTerms.slice(0, 6)) container.append(rankItem(term, true, data));
}

function renderRisingForDataSets(dataSets) {
  const primaryData = dataSets.find((data) => data?.source?.id === activeSource) || radarData;
  const secondaryData = dataSets.find((data) => data?.source?.id === secondarySource) || secondaryRadarData;
  renderRisingList(primaryData, primaryRisingListEl);
  if (secondarySource) renderRisingList(secondaryData, secondaryRisingListEl);
}

function rankItem(term, rising = false, data = radarData) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = [
    "rank-item",
    rising ? "rank-rising" : "",
    selectedTerm?.term === term.term && selectedSourceId === data?.source?.id ? "selected" : ""
  ].join(" ");
  const related = (term.relatedTerms || []).filter(isDisplayTerm).slice(0, 3).map((entry) => entry.term).join(" · ");
  const value = rising && formatDelta(term) ? formatDelta(term) : `${formatNumber(term.count)} mentions`;
  item.innerHTML = `
    <span>
      <strong>${escapeHtml(term.term)}</strong>
      <em>${escapeHtml(related || "-")}</em>
    </span>
    <b>${escapeHtml(value)}</b>
  `;
  item.addEventListener("click", () => {
    const next = data?.terms?.find((entry) => entry.term === term.term && isDisplayTerm(entry)) || term;
    selectTerm(next, data);
  });
  return item;
}

function postElement(post) {
  const link = document.createElement("a");
  link.className = "post-item";
  link.href = post.url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.innerHTML = `
    <span>${escapeHtml(post.title)}</span>
    <small>${escapeHtml(post.date || "-")} · ${formatNumber(post.views)} · ${formatNumber(post.reco)}</small>
  `;
  return link;
}

async function fetchRadar() {
  setStatus("loading");
  if (!radarData) {
    wordCloudEl.innerHTML = `<div class="loading-card">loading</div>`;
  }
  if (secondarySource && !secondaryRadarData) {
    if (secondaryCloudEl) secondaryCloudEl.innerHTML = `<div class="loading-card">loading</div>`;
  }

  const requests = [
    fetchRadarSource(activeSource).then((data) => {
      renderAll(data);
      return data;
    })
  ];
  if (secondarySource) {
    requests.push(
      fetchRadarSource(secondarySource).then((data) => {
        renderSecondary(data);
        return data;
      })
    );
  }

  const results = await Promise.allSettled(requests);
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected && !radarData) {
    setStatus("error");
    wordCloudEl.innerHTML = `<div class="loading-card error">${escapeHtml(rejected.reason?.message || rejected.reason)}</div>`;
  } else if (rejected && secondarySource && !secondaryRadarData) {
    setStatus("partial");
    if (secondaryCloudEl) {
      secondaryCloudEl.innerHTML = `<div class="loading-card error">${escapeHtml(rejected.reason?.message || rejected.reason)}</div>`;
    }
  }
}

async function fetchRadarSource(sourceId) {
  try {
    const cacheBust = Math.floor(Date.now() / 60000);
    const response = await fetch(`${window.TopicRadar?.apiUrl || "/wp-json/topic-radar/v1/radar"}?source=${encodeURIComponent(sourceId)}&_=${cacheBust}`, {
      cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  } catch (error) {
    throw error;
  }
}

fetchRadar();
setInterval(fetchRadar, 120 * 1000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) fetchRadar();
});
