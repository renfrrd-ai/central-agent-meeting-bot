const STORAGE_KEY = "meeting-bot-api-key";

const $ = (id) => document.getElementById(id);

const apiKeyInput = $("apiKey");
const joinForm = $("joinForm");
const joinBtn = $("joinBtn");
const refreshBtn = $("refreshBtn");
const leaveBtn = $("leaveBtn");
const sessionPanel = $("sessionPanel");
const statusGrid = $("statusGrid");
const logEl = $("log");
const alertEl = $("alert");

/** @type {{ meetingUrl: string; meetingRef: { platform: string; native_meeting_id: string; passcode?: string } | null; status: string } | null} */
let activeSession = null;

const platformLabels = {
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
  zoom: "Zoom",
};

function showAlert(message, type = "error") {
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

function getApiKey() {
  return apiKeyInput.value.trim();
}

function saveApiKey() {
  const key = getApiKey();
  if (key) {
    sessionStorage.setItem(STORAGE_KEY, key);
  }
}

function loadApiKey() {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved) {
    apiKeyInput.value = saved;
  }
}

function statusBadgeClass(status) {
  const map = {
    joined: "badge-joined",
    running: "badge-running",
    requested: "badge-requested",
    failed: "badge-failed",
    stopped: "badge-stopped",
    duplicate: "badge-duplicate",
  };
  return map[status] ?? "badge-requested";
}

function renderSession() {
  if (!activeSession?.meetingRef) {
    sessionPanel.classList.remove("visible");
    return;
  }

  const ref = activeSession.meetingRef;
  const platform = platformLabels[ref.platform] ?? ref.platform;

  statusGrid.innerHTML = `
    <div class="status-row">
      <span class="status-label">Platform</span>
      <span class="status-value">${escapeHtml(platform)}</span>
    </div>
    <div class="status-row">
      <span class="status-label">Meeting ID</span>
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
        <span class="badge ${statusBadgeClass(activeSession.status)}">${escapeHtml(activeSession.status)}</span>
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
    button.innerHTML = `<span class="spinner"></span> ${label}`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText ?? label;
  }
}

async function apiRequest(method, path, body) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Enter your API key first (same as API_KEY in .env)");
  }

  saveApiKey();

  const headers = {
    "X-API-Key": apiKey,
    Accept: "application/json",
  };

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

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideAlert();

  const meetingUrl = $("meetingUrl").value.trim();
  const botName = $("botName").value.trim();
  const force = $("force").checked;

  const payload = { meetingUrl };
  if (botName) payload.botName = botName;
  if (force) payload.force = true;

  setLoading(joinBtn, true, "Joining…");

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
      `Join ${data.status}: ${data.meetingRef.platform} / ${data.meetingRef.native_meeting_id}${data.message ? ` — ${data.message}` : ""}`,
    );
    showAlert(
      data.message ?? `Bot status: ${data.status}`,
      data.status === "failed" ? "error" : "success",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Join failed";
    log(message, true);
    showAlert(message, "error");
  } finally {
    setLoading(joinBtn, false, "Join meeting");
  }
});

refreshBtn.addEventListener("click", async () => {
  if (!activeSession?.meetingRef) return;
  hideAlert();

  const ref = activeSession.meetingRef;
  let path = `/api/status/${ref.platform}/${encodeURIComponent(ref.native_meeting_id)}`;
  if (ref.passcode) {
    path += `?passcode=${encodeURIComponent(ref.passcode)}`;
  }

  setLoading(refreshBtn, true, "Checking…");

  try {
    const result = await apiRequest("GET", path);
    activeSession.status = result.data.status;
    renderSession();
    log(`Status refreshed: ${result.data.status}`);
    showAlert(`Current status: ${result.data.status}`, "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status check failed";
    log(message, true);
    showAlert(message, "error");
  } finally {
    setLoading(refreshBtn, false, "Refresh status");
  }
});

leaveBtn.addEventListener("click", async () => {
  if (!activeSession) return;
  hideAlert();

  setLoading(leaveBtn, true, "Leaving…");

  try {
    await apiRequest("POST", "/api/leave", {
      meetingUrl: activeSession.meetingUrl,
    });
    activeSession.status = "stopped";
    renderSession();
    log("Bot left the meeting");
    showAlert("Bot left the meeting", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leave failed";
    log(message, true);
    showAlert(message, "error");
  } finally {
    setLoading(leaveBtn, false, "Leave meeting");
  }
});

apiKeyInput.addEventListener("change", saveApiKey);

loadApiKey();
log("Ready — enter API key and paste a meeting URL");
