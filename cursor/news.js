const newsList = document.getElementById("news-list");
const newsStatus = document.getElementById("news-status");
const newsNextRefresh = document.getElementById("news-next-refresh");
const refreshNewsButton = document.getElementById("refresh-news-btn");

const NEWS_REFRESH_MS = 10 * 60 * 1000;
const NEWS_LIMIT = 6;
const NEWS_FEEDS = [
  {
    url: "https://news.google.com/rss/search?q=ghana+flood+OR+flooding+ghana+when:1d&hl=en-GB&gl=GH&ceid=GH:en",
    forcedSource: "",
  },
  {
    url: "https://news.google.com/rss/search?q=site:myjoyonline.com+flood+ghana+when:2d&hl=en-GB&gl=GH&ceid=GH:en",
    forcedSource: "MyJoyOnline",
  },
  {
    url: "https://news.google.com/rss/search?q=site:3news.com+flood+ghana+when:2d&hl=en-GB&gl=GH&ceid=GH:en",
    forcedSource: "3News",
  },
  {
    url: "https://news.google.com/rss/search?q=site:citinewsroom.com+flood+ghana+when:2d&hl=en-GB&gl=GH&ceid=GH:en",
    forcedSource: "CitiNewsroom",
  },
  {
    url: "https://news.google.com/rss/search?q=site:yen.com.gh+flood+ghana+when:2d&hl=en-GB&gl=GH&ceid=GH:en",
    forcedSource: "YEN",
  },
  {
    url: "https://news.google.com/rss/search?q=site:graphic.com.gh+flood+ghana+when:2d&hl=en-GB&gl=GH&ceid=GH:en",
    forcedSource: "Graphic Online",
  },
  {
    url: "https://nitter.net/search/rss?f=tweets&q=ghana%20flood",
    forcedSource: "X (formerly Twitter)",
  },
];
const TRUSTED_SOURCE_KEYS = [
  "myjoy",
  "joynews",
  "3news",
  "tv3",
  "citi",
  "yen",
  "graphic",
  "ghanaweb",
  "x formerly twitter",
];
const MAX_NEWS_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const NEWS_CACHE_KEY = "floodGuardLiveNewsCache";
const FLOOD_KEYWORDS = [
  "flood",
  "flooding",
  "flash flood",
  "overflow",
  "overflowed",
  "submerge",
  "submerged",
  "spillage",
  "waterlogged",
  "heavy rain",
  "rainstorm",
  "stormwater",
  "drainage",
];
let autoRefreshTimer = null;
let currentNewsItems = [];

initializeNews();
if (refreshNewsButton) {
  refreshNewsButton.addEventListener("click", () => {
    loadLatestNews({ manual: true }).catch(() => {});
  });
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && newsList) {
    loadLatestNews().catch(() => {});
  }
});

function initializeNews() {
  if (!newsList) return;
  if (newsStatus) newsStatus.classList.add("hidden");
  if (newsNextRefresh) newsNextRefresh.classList.add("hidden");
  const cachedAtStart = readCachedNewsItems();
  if (cachedAtStart.length) {
    renderNews(cachedAtStart);
  }
  scheduleAutoRefresh();
  loadLatestNews().catch(() => {
    keepCurrentNewsOrCached();
  });
}

function scheduleAutoRefresh() {
  if (!newsList) return;
  if (autoRefreshTimer) window.clearInterval(autoRefreshTimer);
  autoRefreshTimer = window.setInterval(() => {
    loadLatestNews().catch(() => {});
  }, NEWS_REFRESH_MS);
}

async function loadLatestNews() {
  if (refreshNewsButton) {
    refreshNewsButton.disabled = true;
    refreshNewsButton.textContent = "Refreshing...";
  }
  const feedResults = await Promise.allSettled(
    NEWS_FEEDS.map(async (feed) => {
      const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(feed.url);
      const response = await fetch(proxyUrl, { cache: "no-store" });
      if (!response.ok) return [];
      const rssText = await response.text();
      return parseNewsRss(rssText, feed.forcedSource);
    }),
  );
  const parsed = dedupeNewsItems(
    feedResults
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => result.value),
  );
  const floodOnly = parsed.filter((item) => isFloodRelated(item));
  const now = Date.now();
  const freshOnly = floodOnly.filter((item) => {
    if (!item.publishedAt) return true;
    return now - item.publishedAt <= MAX_NEWS_AGE_MS;
  });
  const trustedFresh = freshOnly.filter((item) => isTrustedSource(item.source));
  const picked = pickLatestFromDifferentSources(
    trustedFresh.length ? trustedFresh : freshOnly,
    NEWS_LIMIT,
  );
  if (!picked.length) {
    if (refreshNewsButton) {
      refreshNewsButton.disabled = false;
      refreshNewsButton.textContent = "Refresh Now";
    }
    keepCurrentNewsOrCached();
    return;
  }
  if (currentNewsItems.length && !hasNewsChanged(picked, currentNewsItems)) {
    if (refreshNewsButton) {
      refreshNewsButton.disabled = false;
      refreshNewsButton.textContent = "Refresh Now";
    }
    return;
  }
  renderNews(picked);
  cacheNewsItems(picked);
  if (refreshNewsButton) {
    refreshNewsButton.disabled = false;
    refreshNewsButton.textContent = "Refresh Now";
  }
}

function parseNewsRss(rssText, forcedSource = "") {
  const parser = new DOMParser();
  const xml = parser.parseFromString(rssText, "application/xml");
  const items = Array.from(xml.querySelectorAll("item"));
  return items
    .map((item) => {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const link = sanitizeExternalUrl(item.querySelector("link")?.textContent?.trim() || "");
      const pubDate = item.querySelector("pubDate")?.textContent?.trim() || "";
      const publishedAt = parsePublishedAt(pubDate);
      const sourceTag = item.querySelector("source")?.textContent?.trim() || "";
      const source = normalizeSourceLabel(
        forcedSource || sourceTag || extractSourceFromTitle(title) || hostnameLabel(link),
        link,
      );
      const cleanTitle = stripSourceSuffix(title);
      return {
        title: cleanTitle,
        description: item.querySelector("description")?.textContent?.trim() || "",
        link,
        source,
        publishedAt,
        time: formatRelativeTime(publishedAt),
      };
    })
    .filter((item) => item.title && item.link);
}

function pickLatestFromDifferentSources(items, limit) {
  const preferredSources = ["X", "Joy", "3News", "Citi", "YEN", "Graphic", "GhanaWeb", "NADMO"];
  const sourceSeen = new Set();
  const prioritized = [];
  const others = [];

  const ordered = [...items].sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  ordered.forEach((item) => {
    const key = normalizeSourceKey(item.source);
    if (!key) return;
    const isPreferred = preferredSources.some((source) => key.includes(source.toLowerCase()));
    if (isPreferred && !sourceSeen.has(key)) {
      sourceSeen.add(key);
      prioritized.push(item);
      return;
    }
    others.push(item);
  });

  const merged = [...prioritized];
  for (const item of others) {
    if (merged.length >= limit) break;
    const key = normalizeSourceKey(item.source);
    if (!sourceSeen.has(key)) {
      sourceSeen.add(key);
      merged.push(item);
    }
  }
  if (merged.length < limit) {
    ordered.forEach((item) => {
      if (merged.length >= limit) return;
      if (!merged.find((existing) => existing.link === item.link)) {
        merged.push(item);
      }
    });
  }
  return merged.slice(0, limit);
}

function dedupeNewsItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeSourceKey(`${item.title} ${item.link}`);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isFloodRelated(item) {
  const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
  const hasFloodKeyword = FLOOD_KEYWORDS.some((keyword) => text.includes(keyword));
  // Keep flood-related stories; Ghana context is a ranking preference handled upstream.
  return hasFloodKeyword;
}

function cacheNewsItems(items) {
  try {
    const payload = {
      savedAt: Date.now(),
      items: items.slice(0, NEWS_LIMIT),
    };
    localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(payload));
  } catch (_error) {
    // Ignore cache write failures.
  }
}

function renderCachedNews() {
  const cachedItems = readCachedNewsItems();
  if (cachedItems.length) {
    renderNews(cachedItems);
    return;
  }
}

function keepCurrentNewsOrCached() {
  if (currentNewsItems.length) {
    // Keep the currently displayed headlines and status unchanged.
    return;
  }
  renderCachedNews();
}

function readCachedNewsItems() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter((item) => item && item.title && item.link).slice(0, NEWS_LIMIT);
  } catch (_error) {
    return [];
  }
}

function renderNews(items) {
  if (!newsList) return;
  currentNewsItems = items.slice();
  newsList.innerHTML = "";
  items.forEach((item) => {
    const article = document.createElement("article");
    article.className = "report-item news-item";
    article.innerHTML = `
      <p class="report-headline">${escapeHtml(item.title)}</p>
      <p class="report-time">Source: ${escapeHtml(item.source)}${item.time ? ` | ${escapeHtml(item.time)}` : ""}</p>
      <a class="btn btn-secondary btn-small news-link" href="${escapeHtml(
        item.link,
      )}" target="_blank" rel="noopener noreferrer">Read Full Story</a>
    `;
    newsList.appendChild(article);
  });
}

function hasNewsChanged(nextItems, currentItems) {
  if (nextItems.length !== currentItems.length) return true;
  const currentLinks = currentItems.map((item) => item.link).join("|");
  const nextLinks = nextItems.map((item) => item.link).join("|");
  return currentLinks !== nextLinks;
}

function stripSourceSuffix(title) {
  const index = title.lastIndexOf(" - ");
  if (index <= 0) return title;
  return title.slice(0, index).trim();
}

function extractSourceFromTitle(title) {
  const index = title.lastIndexOf(" - ");
  if (index <= 0) return "";
  return title.slice(index + 3).trim();
}

function hostnameLabel(link) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    return host.split(".")[0];
  } catch (_error) {
    return "News Source";
  }
}

function normalizeSourceLabel(source, link) {
  const sourceText = String(source || "");
  const linkText = String(link || "");
  const lower = `${sourceText} ${linkText}`.toLowerCase();
  if (lower.includes("nitter") || lower.includes("x.com") || lower.includes("twitter.com")) {
    return "X (formerly Twitter)";
  }
  return sourceText || "News Source";
}

function formatRelativeTime(pubDate) {
  if (!pubDate) return "";
  const minutes = Math.round((Date.now() - pubDate) / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function parsePublishedAt(pubDate) {
  if (!pubDate) return null;
  const date = new Date(pubDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function normalizeSourceKey(source) {
  return String(source || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTrustedSource(source) {
  const key = normalizeSourceKey(source);
  if (!key) return false;
  return TRUSTED_SOURCE_KEYS.some((trustedKey) => key.includes(trustedKey));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.href;
  } catch (_error) {
    return "";
  }
}
