"use strict";

const REQUIRED_HEADERS = [
  "Studio Name",
  "Thumbnail URL",
  "Last Update",
  "State",
  "Expected Start Date",
  "Expected End Date",
];

const DONATION_URL = "https://www.zeffy.com/en-CA/donation-form/donate-to-ents--5";

const STATE_META = {
  NOT_SCHEDULED: {
    label: "Not yet scheduled",
    location: "Currently at the old space",
    dateLabel: "Moving dates",
    color: "#687785",
    soft: "#eef2f5",
    order: 2,
    acceptsDonations: true,
  },
  NOT_STARTED: {
    label: "Move scheduled",
    location: "Currently at the old space",
    dateLabel: "Expected move window",
    color: "#1769aa",
    soft: "#e9f3fb",
    order: 3,
    acceptsDonations: true,
  },
  IN_PROGRESS: {
    label: "Moving now",
    location: "In transit - temporarily unavailable",
    dateLabel: "Expected move window",
    color: "#c8710a",
    soft: "#fff3d8",
    order: 0,
    acceptsDonations: true,
  },
  DONE: {
    label: "Move complete",
    location: "Now at the new space",
    dateLabel: "Moved",
    color: "#18825f",
    soft: "#e8f7f1",
    order: 4,
    acceptsDonations: true,
    ongoingDonations: true,
  },
  DONE_BUT_PENDING_BUDGET: {
    label: "Moved — setup pending",
    location: "At the new space, but not yet available",
    dateLabel: "Moved",
    color: "#7652a6",
    soft: "#f1ecf8",
    order: 4,
    acceptsDonations: true,
  },
};

const UNKNOWN_STATE = {
  label: "Status unknown",
  location: "Check the latest update",
  dateLabel: "Moving dates",
  color: "#687785",
  soft: "#eef2f5",
  order: 5,
};

function normalizeHeader(value) {
  return value.replace(/^\uFEFF/, "").trim().toLocaleLowerCase();
}

/** Parse RFC 4180-style CSV, including quoted commas, quotes, and line breaks. */
function parseCSV(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }

  return rows;
}

function rowsToRecords(rows) {
  if (rows.length === 0) return [];

  const normalizedHeaders = rows[0].map(normalizeHeader);
  const indexByHeader = new Map(normalizedHeaders.map((header, index) => [header, index]));
  const missing = REQUIRED_HEADERS.filter(
    (header) => !indexByHeader.has(normalizeHeader(header)),
  );

  if (missing.length > 0) {
    throw new Error(`Missing CSV header${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`);
  }

  const get = (row, header) => row[indexByHeader.get(normalizeHeader(header))]?.trim() ?? "";

  return rows.slice(1).map((row) => ({
    name: get(row, "Studio Name"),
    thumbnail: get(row, "Thumbnail URL"),
    update: get(row, "Last Update"),
    state: get(row, "State").toUpperCase(),
    start: get(row, "Expected Start Date"),
    end: get(row, "Expected End Date"),
  })).filter((record) => record.name);
}

function formatDateRange(record) {
  if (!record.start && !record.end) return "To be announced";
  if (record.start && record.end && record.start !== record.end) {
    return `${record.start} – ${record.end}`;
  }
  return record.end || record.start;
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function createIcon() {
  const wrapper = document.createElement("span");
  wrapper.className = "location-icon";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2" fill="currentColor"/></svg>';
  return wrapper;
}

function createStudioCard(record) {
  const meta = STATE_META[record.state] || UNKNOWN_STATE;
  const article = document.createElement("article");
  article.className = "studio-card";
  article.style.setProperty("--state-color", meta.color);
  article.style.setProperty("--state-soft", meta.soft);

  const thumb = document.createElement("div");
  thumb.className = "studio-thumb";
  const fallback = document.createElement("span");
  fallback.className = "thumb-fallback";
  fallback.textContent = initials(record.name);
  thumb.append(fallback);

  if (record.thumbnail) {
    const image = document.createElement("img");
    image.src = record.thumbnail;
    image.alt = `${record.name} studio`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => image.remove(), { once: true });
    thumb.append(image);
  }

  const body = document.createElement("div");
  body.className = "studio-body";

  const topLine = document.createElement("div");
  topLine.className = "card-topline";
  const title = document.createElement("h3");
  title.textContent = record.name;
  const badge = document.createElement("span");
  badge.className = "state-badge";
  badge.textContent = meta.label;
  topLine.append(title, badge);

  const location = document.createElement("p");
  location.className = "location";
  location.append(createIcon(), document.createTextNode(meta.location));

  const dateRow = document.createElement("p");
  dateRow.className = "date-row";
  const dateLabel = document.createElement("span");
  dateLabel.textContent = meta.dateLabel;
  const dateValue = document.createElement("strong");
  dateValue.textContent = formatDateRange(record);
  dateRow.append(dateLabel, dateValue);

  body.append(topLine, location, dateRow);

  if (record.update) {
    const update = document.createElement("p");
    update.className = "last-update";
    const label = document.createElement("strong");
    label.textContent = "Latest update: ";
    update.append(label, document.createTextNode(record.update));
    body.append(update);
  }

  if (meta.acceptsDonations) {
    const donationLink = document.createElement("a");
    donationLink.className = "donation-link";
    donationLink.href = DONATION_URL;
    donationLink.target = "_blank";
    donationLink.rel = "noopener noreferrer";
    donationLink.setAttribute("aria-label", `Donate to help set up ${record.name}`);
    let donationText = "Help fund setup";
    if (meta.ongoingDonations) {
      donationText = "Help fund improvements";
    }
    donationLink.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S4 16 4 9.8A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 8 2.3c0 6.2-8 10.7-8 10.7Z" fill="currentColor"/></svg><span>${donationText}</span>`;
    body.append(donationLink);
  }

  article.append(thumb, body);
  return article;
}

function renderSummary(records) {
  const summary = document.querySelector("#summary");
  summary.replaceChildren();

  const summaries = [
    ["DONE", "at new space"],
    ["DONE_BUT_PENDING_BUDGET", "awaiting setup funds"],
    ["IN_PROGRESS", "moving now"],
    ["NOT_STARTED", "scheduled"],
    ["NOT_SCHEDULED", "not yet scheduled"],
  ];

  for (const [state, label] of summaries) {
    const count = records.filter((record) => record.state === state).length;
    if (count === 0) continue;
    const chip = document.createElement("span");
    chip.className = "summary-chip";
    chip.style.setProperty("--chip-color", STATE_META[state].color);
    const dot = document.createElement("span");
    dot.className = "summary-dot";
    dot.setAttribute("aria-hidden", "true");
    const number = document.createElement("strong");
    number.textContent = String(count);
    chip.append(dot, number, document.createTextNode(label));
    summary.append(chip);
  }
}

function render(records) {
  const grid = document.querySelector("#studio-grid");
  const message = document.querySelector("#status-message");

  if (records.length === 0) {
    message.className = "status-message";
    message.textContent = "No studios are listed in the move schedule yet.";
    grid.setAttribute("aria-busy", "false");
    return;
  }

  // const sorted = [...records].sort((a, b) => {
  //   const stateDifference = (STATE_META[a.state] || UNKNOWN_STATE).order - (STATE_META[b.state] || UNKNOWN_STATE).order;
  //   return stateDifference || a.name.localeCompare(b.name);
  // });
  const sorted = records;

  const fragment = document.createDocumentFragment();
  sorted.forEach((record) => fragment.append(createStudioCard(record)));
  grid.replaceChildren(fragment);
  grid.setAttribute("aria-busy", "false");
  message.hidden = true;
}

function showError(error) {
  const message = document.querySelector("#status-message");
  const grid = document.querySelector("#studio-grid");
  message.className = "status-message error";
  message.replaceChildren();
  const text = document.createElement("span");
  text.textContent = "The studio schedule could not be loaded. Please try refreshing the page in a moment.";
  message.append(text);
  grid.setAttribute("aria-busy", "false");
  console.error("Unable to load /timeline.csv:", error);
}

async function loadTimeline() {
  try {
    const response = await fetch("timeline.csv", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const records = rowsToRecords(parseCSV(await response.text()));
    render(records);

    const loadedAt = new Date();
    const loadedTime = document.querySelector("#loaded-time");
    loadedTime.dateTime = loadedAt.toISOString();
    loadedTime.textContent = loadedAt.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (error) {
    showError(error);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DONATION_URL, STATE_META, parseCSV, rowsToRecords };
}

if (typeof document !== "undefined") {
  loadTimeline();
}
