const POLL_MS = 3000;
const TERMINAL_STATUSES = new Set(["joined", "failed", "stopped"]);

const $ = (id) => document.getElementById(id);

const joinForm = $("joinForm");
const joinBtn = $("joinBtn");
const leaveBtn = $("leaveBtn");
const sessionPanel = $("sessionPanel");
const statusGrid = $("statusGrid");
const pollNote = $("pollNote");
const logEl = $("log");
const alertEl = $("alert");

/** @type {{ meetingUrl: string; meetingRef: { platform: string; native_meeting_id: string; passcode?: string } | null; status: string } | null} */
let activeSession = null;
let statusPollId = null;
let lastLoggedStatus = null;

const platformLabels = {
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
  zoom: "Zoom",
};

const statusLabels = {
  requested: "Starting…",
  running: "Connecting…",
  awaiting_admission: "Waiting for host",
  joined: "In meeting",
  failed: "Failed",
  stopped: "Left",
  duplicate: "Already running",
};

function showAlert(message, type = "info") {
  alertEl.textContent = message;
  alertEl.className = `alert visible alert-${type}`;
}

function hideAlert() {
  alertEl.className = "alert";
  alertEl.textContent = "";
}

function log(message, isError = false) {
  const entry = document.createElement("div");
  entry.className = `log-entry${isError ? " error" : ""}`;
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString();
  entry.appendChild(time);
  entry.append(message);
  logEl.prepend(entry);
}

function formatStatus(status) {
  return statusLabels[status] ?? status;
}

function statusPillClass(status) {
  if (status === "joined") return "state-joined";
  if (status === "failed" || status === "stopped") return "state-error";
  if (status === "duplicate" || status === "awaiting_admission") return "state-warn";
  return "state-progress";
}

function isLiveStatus(status) {
  return (
    !TERMINAL_STATUSES.has(status) && status !== "duplicate"
  );
}

function stopStatusPolling() {
  if (statusPollId !== null) {
    clearInterval(statusPollId);
    statusPollId = null;
  }
  pollNote.hidden = true;
}

function startStatusPolling() {
  stopStatusPolling();
  if (!activeSession?.meetingRef) return;

  pollNote.hidden = false;

  void refreshStatus({ quiet: true });

  statusPollId = window.setInterval(() => {
    void refreshStatus({ quiet: true });
  }, POLL_MS);
}

function statusPath() {
  const ref = activeSession?.meetingRef;
  if (!ref) return null;
  let path = `/api/status/${ref.platform}/${encodeURIComponent(ref.native_meeting_id)}`;
  if (ref.passcode) {
    path += `?passcode=${encodeURIComponent(ref.passcode)}`;
  }
  return path;
}

function renderSession() {
  if (!activeSession?.meetingRef) {
    sessionPanel.classList.remove("visible");
    return;
  }

  const ref = activeSession.meetingRef;
  const platform = platformLabels[ref.platform] ?? ref.platform;
  const status = activeSession.status;
  const live = isLiveStatus(status);

  statusGrid.innerHTML = `
    <div class="status-row">
      <span class="status-label">Platform</span>
      <span class="status-value">${escapeHtml(platform)}</span>
    </div>
    <div class="status-row">
      <span class="status-label">ID</span>
      <span class="status-value">${escapeHtml(ref.native_meeting_id)}</span>
    </div>
    ${
      ref.passcode
        ? `<div class="status-row">
      <span class="status-label">Passcode</span>
      <span class="status-value">${escapeHtml(ref.passcode)}</span>
    </div>`
        : ""
    }
    <div class="status-row">
      <span class="status-label">Status</span>
      <span class="status-value">
        <span class="status-pill ${statusPillClass(status)}${live ? " is-live" : ""}">${escapeHtml(formatStatus(status))}</span>
      </span>
    </div>
  `;

  sessionPanel.classList.add("visible");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function setLoading(button, loading, label) {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = `<span class="spinner"></span>${label}`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText ?? label;
  }
}

async function apiRequest(method, path, body) {
  const headers = { Accept: "application/json" };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg =
      json?.error?.message ??
      json?.message ??
      `Request failed (${response.status})`;
    throw new Error(msg);
  }

  return json;
}

function onStatusChange(prev, next) {
  if (prev === next) return;
  log(`Status: ${formatStatus(next)}`);
  lastLoggedStatus = next;

  if (next === "awaiting_admission") {
    showAlert("Bot is in the lobby — admit it in the meeting.", "info");
  } else if (next === "joined") {
    showAlert("Bot is in the meeting.", "success");
  } else if (next === "failed") {
    showAlert("Join failed. Check the meeting link or Vexa logs.", "error");
  } else if (next === "stopped") {
    showAlert("Bot is no longer in the meeting.", "info");
    stopStatusPolling();
  } else if (isLiveStatus(next)) {
    showAlert(`${formatStatus(next)} Waiting for Vexa…`, "info");
  }
}

async function refreshStatus(options = {}) {
  const { quiet = false } = options;
  const path = statusPath();
  if (!path || !activeSession) return;

  try {
    const result = await apiRequest("GET", path);
    const prev = activeSession.status;
    const next = result.data.status;
    activeSession.status = next;
    renderSession();

    if (!quiet || prev !== next) {
      onStatusChange(prev, next);
    } else if (lastLoggedStatus !== next) {
      lastLoggedStatus = next;
    }

    if (TERMINAL_STATUSES.has(next) && next !== "joined") {
      stopStatusPolling();
    } else if (TERMINAL_STATUSES.has(next) && next === "joined") {
      pollNote.textContent = "Watching for disconnect";
    }
  } catch (error) {
    if (!quiet) {
      const message = error instanceof Error ? error.message : "Status check failed";
      log(message, true);
      showAlert(message, "error");
    }
  }
}

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert();
  stopStatusPolling();
  lastLoggedStatus = null;

  const meetingUrl = $("meetingUrl").value.trim();
  const botName = $("botName").value.trim();
  const force = $("force").checked;

  const payload = { meetingUrl };
  if (botName) payload.botName = botName;
  if (force) payload.force = true;

  setLoading(joinBtn, true, "Joining…");
  showAlert("Requesting bot join…", "info");

  try {
    const result = await apiRequest("POST", "/api/join", payload);
    const data = result.data;

    activeSession = {
      meetingUrl,
      meetingRef: data.meetingRef,
      status: data.status,
    };

    renderSession();
    log(
      `Join response: ${formatStatus(data.status)}${data.message ? ` — ${data.message}` : ""}`,
    );

    if (data.status === "awaiting_admission") {
      showAlert("Bot is waiting for the host to admit it.", "info");
      startStatusPolling();
    } else if (data.status === "joined") {
      showAlert("Bot is in the meeting.", "success");
      startStatusPolling();
      pollNote.textContent = "Watching for disconnect";
    } else if (data.status === "failed") {
      showAlert(data.message ?? "Join failed.", "error");
    } else if (data.status === "duplicate") {
      showAlert("A bot is already running for this meeting. Checking live status…", "info");
      startStatusPolling();
    } else {
      showAlert(`${formatStatus(data.status)} Polling until ready…`, "info");
      startStatusPolling();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Join failed";
    log(message, true);
    showAlert(message, "error");
  } finally {
    setLoading(joinBtn, false, "Join");
  }
});

leaveBtn.addEventListener("click", async () => {
  if (!activeSession) return;
  hideAlert();
  stopStatusPolling();

  setLoading(leaveBtn, true, "Leaving…");

  try {
    await apiRequest("POST", "/api/leave", {
      meetingUrl: activeSession.meetingUrl,
    });
    const prev = activeSession.status;
    activeSession.status = "stopped";
    renderSession();
    onStatusChange(prev, "stopped");
    log("Left meeting");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leave failed";
    log(message, true);
    showAlert(message, "error");
    startStatusPolling();
  } finally {
    setLoading(leaveBtn, false, "Leave");
  }
});

log("Ready");
