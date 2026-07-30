const API_ORIGIN = window.location.hostname === "alexislisteningto.github.io"
  ? "https://alex-is-listening-to.alex-f16.workers.dev"
  : "";
const elements = {
  hero: document.querySelector(".hero"),
  themeColor: document.querySelector('meta[name="theme-color"]'),
  listeningStatus: document.querySelector("#listening-status"),
  heading: document.querySelector("#now-heading"),
  coverLink: document.querySelector("#current-cover-link"),
  cover: document.querySelector("#current-cover"),
  trackLink: document.querySelector("#current-track-link"),
  trackName: document.querySelector("#track-name"),
  artistName: document.querySelector("#artist-name"),
  playCount: document.querySelector("#play-count"),
  recentStatus: document.querySelector("#recent-status"),
  recentGrid: document.querySelector("#recent-grid"),
  allTimeStatus: document.querySelector("#all-time-status"),
  allTimeList: document.querySelector("#all-time-list"),
  form: document.querySelector("#recommendation-form"),
  input: document.querySelector("#recommendation-input"),
  submit: document.querySelector("#recommendation-submit"),
  formStatus: document.querySelector("#form-status"),
  turnstile: document.querySelector("#turnstile-widget"),
};

let turnstileSiteKey = "";
let turnstileWidgetId;
let turnstileLoaded = false;

function ordinal(value) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[value % 10] ?? "th";
  return `${value}${suffix}`;
}

function createArtwork(image, alt, className) {
  if (!image) {
    const missing = document.createElement("span");
    missing.className = `${className} missing-art`;
    missing.textContent = "no cover";
    return missing;
  }

  const artwork = document.createElement("img");
  artwork.className = className;
  artwork.src = image;
  artwork.alt = alt;
  artwork.width = 300;
  artwork.height = 300;
  artwork.loading = "lazy";
  artwork.decoding = "async";
  return artwork;
}

function renderRecent(tracks) {
  const fragment = document.createDocumentFragment();

  for (const track of tracks) {
    const details = document.createElement("details");
    details.className = "recent-album";

    const summary = document.createElement("summary");
    summary.append(createArtwork(track.image, `${track.album || track.name} by ${track.artist}`, "recent-art"));
    const accessibleName = document.createElement("span");
    accessibleName.className = "sr-only";
    accessibleName.textContent = `${track.name} by ${track.artist}`;
    summary.append(accessibleName);

    const caption = document.createElement("div");
    caption.className = "recent-caption";
    const link = document.createElement("a");
    link.href = track.url;
    link.textContent = track.album || track.name;
    caption.append(link, document.createElement("br"), track.artist);

    details.append(summary, caption);
    fragment.append(details);
  }

  elements.recentGrid.replaceChildren(fragment);
  elements.recentStatus.hidden = true;
}

function renderTopAlbums(albums) {
  const fragment = document.createDocumentFragment();

  for (const album of albums) {
    const item = document.createElement("li");
    item.append(createArtwork(album.image, `${album.name} by ${album.artist}`, "rank-cover"));

    const copy = document.createElement("div");
    copy.className = "album-copy";
    const link = document.createElement("a");
    link.href = album.url;
    link.textContent = album.name;
    const meta = document.createElement("span");
    meta.className = "album-meta";
    meta.textContent = `${album.artist} · ${Number(album.playcount).toLocaleString()} plays`;
    copy.append(link, meta);
    item.append(copy);
    fragment.append(item);
  }

  elements.allTimeList.replaceChildren(fragment);
  elements.allTimeStatus.hidden = true;
}

function relativeLuminance(red, green, blue) {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function colorHeroFromCover() {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(elements.cover, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;

    for (let index = 0; index < pixels.length; index += 16) {
      if (pixels[index + 3] < 128) continue;
      red += pixels[index];
      green += pixels[index + 1];
      blue += pixels[index + 2];
      count += 1;
    }

    if (!count) return;
    red = Math.round(red / count);
    green = Math.round(green / count);
    blue = Math.round(blue / count);
    const background = `rgb(${red} ${green} ${blue})`;
    const luminance = relativeLuminance(red, green, blue);
    const inkLuminance = relativeLuminance(24, 21, 18);
    const paperLuminance = relativeLuminance(246, 240, 219);
    const foreground = contrastRatio(luminance, inkLuminance) >= contrastRatio(luminance, paperLuminance) ? "#181512" : "#f6f0db";

    elements.hero.style.setProperty("--hero-bg", background);
    elements.hero.style.setProperty("--hero-ink", foreground);
    elements.themeColor.content = background;
  } catch {
    // Some album-art hosts deny canvas access. The stable paper fallback stays readable.
  }
}

function renderCurrent(current) {
  if (!current) {
    elements.listeningStatus.textContent = "last.fm is being mysterious";
    elements.coverLink.hidden = true;
    return;
  }

  elements.listeningStatus.textContent = current.nowPlaying ? "scrobbling right now" : "last scrobbled";
  elements.heading.textContent = current.nowPlaying ? "alex is listening to:" : "alex was listening to:";
  elements.trackName.textContent = current.name;
  elements.artistName.textContent = current.artist;
  elements.trackLink.href = current.url;
  elements.coverLink.href = current.url;

  if (current.image) {
    elements.cover.crossOrigin = "anonymous";
    elements.cover.src = current.image;
    elements.cover.alt = `${current.album || current.name} by ${current.artist}`;
    elements.cover.addEventListener("load", colorHeroFromCover, { once: true });
    elements.cover.addEventListener("error", () => { elements.coverLink.hidden = true; }, { once: true });
  } else {
    elements.coverLink.hidden = true;
  }

  if (current.playcount > 0) {
    elements.playCount.textContent = `for the ${ordinal(current.playcount)} time`;
    elements.playCount.hidden = false;
  }
}

async function loadMusic() {
  try {
    const response = await fetch(`${API_ORIGIN}/api/music?v=3`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`music request failed with ${response.status}`);
    const music = await response.json();
    renderCurrent(music.current);
    renderRecent(music.recent);
    renderTopAlbums(music.topAlbums);
  } catch (error) {
    console.error(error);
    elements.listeningStatus.textContent = "last.fm isn't answering right now";
    elements.recentStatus.textContent = "couldn't get the last nine. try again in a minute.";
    elements.allTimeStatus.textContent = "the top 100 wandered off. try again in a minute.";
  }
}

function maybeRenderTurnstile() {
  if (!turnstileLoaded || !turnstileSiteKey || turnstileWidgetId !== undefined) return;
  turnstileWidgetId = window.turnstile.render(elements.turnstile, {
    sitekey: turnstileSiteKey,
    action: "recommend_music",
    callback: () => {
      elements.submit.disabled = false;
      elements.formStatus.textContent = "ready when you are";
      elements.formStatus.dataset.state = "ready";
    },
    "expired-callback": () => {
      elements.submit.disabled = true;
      elements.formStatus.textContent = "spam check expired. give it another second.";
    },
    "error-callback": () => {
      elements.submit.disabled = true;
      elements.formStatus.textContent = "spam checker didn't load. refresh and try again.";
      elements.formStatus.dataset.state = "error";
    },
  });
}

window.onTurnstileLoad = () => {
  turnstileLoaded = true;
  maybeRenderTurnstile();
};

async function loadPublicConfig() {
  try {
    const response = await fetch(`${API_ORIGIN}/api/config?v=3`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`config request failed with ${response.status}`);
    const config = await response.json();
    turnstileSiteKey = config.turnstileSiteKey;
    maybeRenderTurnstile();
  } catch (error) {
    console.error(error);
    elements.formStatus.textContent = "recommendations are offline right now";
    elements.formStatus.dataset.state = "error";
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const recommendation = elements.input.value.trim();
  const turnstileToken = turnstileWidgetId === undefined ? "" : window.turnstile.getResponse(turnstileWidgetId);

  if (!recommendation || !turnstileToken) {
    elements.formStatus.textContent = "write something and finish the spam check first";
    elements.formStatus.dataset.state = "error";
    return;
  }

  elements.submit.disabled = true;
  elements.submit.textContent = "sending...";
  elements.formStatus.textContent = "sending it to alex...";
  elements.formStatus.dataset.state = "loading";

  try {
    const response = await fetch(`${API_ORIGIN}/api/recommend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recommendation, turnstileToken }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "couldn't send that");

    elements.input.value = "";
    elements.formStatus.textContent = "sent. thank you :)";
    elements.formStatus.dataset.state = "success";
  } catch (error) {
    elements.formStatus.textContent = error instanceof Error ? error.message : "couldn't send that";
    elements.formStatus.dataset.state = "error";
  } finally {
    elements.submit.textContent = "send it";
    if (turnstileWidgetId !== undefined) window.turnstile.reset(turnstileWidgetId);
  }
});

void loadMusic();
void loadPublicConfig();
