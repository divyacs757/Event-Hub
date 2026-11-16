const API = "/api";
let token = localStorage.getItem("eh_token") || "";
let currentUser = JSON.parse(localStorage.getItem("eh_user") || "null");
let authMode = "login";
let editingEventId = null;
let pendingEvent = null;
const $ = (id) => document.getElementById(id);

function headers(json=true) {
  const h = {};
  if (token) h.Authorization = `Bearer ${token}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}
async function api(path, options={}) {
  const response = await fetch(API + path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 3200);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function dateText(value) {
  return new Date(value).toLocaleString([], {dateStyle:"medium", timeStyle:"short"});
}
function saveSession(data) {
  token = data.token; currentUser = data.user;
  localStorage.setItem("eh_token", token);
  localStorage.setItem("eh_user", JSON.stringify(currentUser));
  updateNav();
}
function clearSession() {
  token = ""; currentUser = null;
  localStorage.removeItem("eh_token"); localStorage.removeItem("eh_user");
  updateNav();
}
function updateNav() {
  $("loginOpen").classList.toggle("hidden", !!currentUser);
  $("registerOpen").classList.toggle("hidden", !!currentUser);
  $("logoutBtn").classList.toggle("hidden", !currentUser);
  $("dashboardOpen").classList.toggle("hidden", !currentUser);
  $("quickDashboard").classList.toggle("hidden", !currentUser);
  $("userLabel").classList.toggle("hidden", !currentUser);
  $("userLabel").textContent = currentUser ? `${currentUser.name} · ${currentUser.role}` : "";
}
function showSection(id) {
  ["home","events","dashboard"].forEach(s => $(s).classList.toggle("hidden", s !== id));
  window.scrollTo({top:0,behavior:"smooth"});
}
function openAuth(mode) {
  authMode = mode;
  $("authModal").classList.remove("hidden");
  $("authTitle").textContent = mode === "login" ? "Welcome back" : "Create your account";
  $("authSubmit").textContent = mode === "login" ? "Login" : "Create account";
  $("nameField").classList.toggle("hidden", mode === "login");
  $("extraFields").classList.toggle("hidden", mode === "login");
  $("authForm").elements.name.required = mode === "register";
  $("authForm").elements.password.autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authMessage").textContent = "";
}
async function loadEvents() {
  try {
    const data = await api("/events");
    const grid = $("eventGrid");
    if (!data.events.length) { grid.innerHTML = '<div class="empty-state">No events published yet. Please check again soon.</div>'; return; }
    grid.innerHTML = data.events.map(e => `
      <article class="event-card">
        <span class="tag">${escapeHtml(e.category)}</span>
        <h3>${escapeHtml(e.title)}</h3>
        <p>${escapeHtml(e.description)}</p>
        <div class="event-meta">📅 ${dateText(e.event_date)}<br>📍 ${escapeHtml(e.venue)}<br>👥 ${e.registered_count}/${e.capacity} registered · ${Number(e.registration_fee) ? "₹"+e.registration_fee : "Free"}</div>
        ${e.pamphlet_url ? `<a class="btn btn-ghost" href="${e.pamphlet_url}" target="_blank" rel="noopener">View pamphlet</a>` : ""}
        <button class="btn btn-primary register-event" data-id="${e.id}">Register / Details</button>
        <div class="winners-slot" id="winners-${e.id}"></div>
      </article>`).join("");
    grid.querySelectorAll(".register-event").forEach(b => b.addEventListener("click", () => registerForEvent(b.dataset.id, data.events)));
    data.events.forEach(e => loadPublicWinners(e.id));
  } catch (e) { $("eventGrid").innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`; }
}
async function loadPublicWinners(id) {
  try {
    const data = await api(`/events/${id}/winners`);
    if (!data.winners.length || new Date(data.event.event_date) > new Date()) return;
    const slot = $(`winners-${id}`);
    if (slot) slot.innerHTML = `<div class="event-meta"><strong>🏆 Top winners</strong><br>${data.winners.map(w => `${w.position}. ${escapeHtml(w.winner_name)} — ₹${Number(w.prize_amount).toLocaleString("en-IN")}`).join("<br>")}</div>`;
  } catch {}
}
async function registerForEvent(id, events=[]) {
  if (!currentUser) { openAuth("login"); $("authMessage").textContent = "Please log in as a student to register."; return; }
  if (currentUser.role !== "student") { toast("Student accounts can register for events."); return; }
  const event = events.find(e => String(e.id) === String(id));
  if (!event) { toast("Event details could not be loaded. Please refresh and try again."); return; }
  pendingEvent = event;
  $("eventConfirmDetails").innerHTML = `<div class="confirm-detail"><small>EVENT</small><strong>${escapeHtml(event.title)}</strong></div><div class="confirm-detail"><small>DATE & TIME</small><strong>${escapeHtml(dateText(event.event_date))}</strong></div><div class="confirm-detail"><small>VENUE</small><strong>${escapeHtml(event.venue)}</strong></div><div class="confirm-detail"><small>REGISTRATION FEE</small><strong>${Number(event.registration_fee) ? "₹"+Number(event.registration_fee).toLocaleString("en-IN") : "Free"}</strong></div><div class="confirm-detail"><small>REGISTERING AS</small><strong>${escapeHtml(currentUser.name)} · ${escapeHtml(currentUser.email)}</strong></div>`;
  $("eventConfirmMessage").textContent = "";
  $("eventConfirmSubmit").disabled = false;
  $("eventConfirmModal").classList.remove("hidden");
}
async function confirmEventRegistration() {
  if (!pendingEvent) return;
  const button = $("eventConfirmSubmit");
  button.disabled = true;
  button.textContent = "Submitting…";
  try {
    const result = await api(`/registrations/${pendingEvent.id}`, {method:"POST",headers:headers(),body:"{}"});
    $("eventConfirmModal").classList.add("hidden");
    toast(result.emailSent ? "Registration confirmed! Confirmation email sent." : "Registration confirmed. Email delivery is not configured; contact the administrator.");
    pendingEvent = null;
    await loadEvents();
    await loadDashboard();
  } catch (e) {
    $("eventConfirmMessage").textContent = e.message;
  } finally {
    button.disabled = false;
    button.textContent = "Confirm registration";
  }
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function renderAdminEvents(events) {
  const target = $("adminEventList");
  if (!target) return;
  if (!events.length) { target.innerHTML = "<p>No events available. Use the form above to create one.</p>"; return; }
  target.innerHTML = `<table class="data-table"><thead><tr><th>Event</th><th>Date</th><th>Registrations</th><th>Actions</th></tr></thead><tbody>${events.map(e => `
    <tr><td><strong>${escapeHtml(e.title)}</strong><br><small>${escapeHtml(e.category)}</small></td>
    <td>${dateText(e.event_date)}</td><td>${e.registered_count}/${e.capacity}</td>
    <td><button class="btn btn-ghost edit-event" data-id="${e.id}">Edit</button> <button class="btn btn-ghost delete-event" data-id="${e.id}">Delete</button></td></tr>`).join("")}</tbody></table>`;
  target.querySelectorAll(".edit-event").forEach(b => b.addEventListener("click", () => editEvent(b.dataset.id, events)));
  target.querySelectorAll(".delete-event").forEach(b => b.addEventListener("click", () => deleteEvent(b.dataset.id)));
}
function editEvent(id, events) {
  const event = events.find(e => String(e.id) === String(id));
  if (!event) return;
  editingEventId = event.id;
  const form = $("eventForm");
  for (const field of ["title","description","category","venue","capacity","registration_fee","prize_money","payment_instructions"]) {
    if (form.elements[field]) form.elements[field].value = event[field] ?? "";
  }
  form.elements.event_date.value = toDateTimeLocal(event.event_date);
  form.elements.registration_deadline.value = toDateTimeLocal(event.registration_deadline);
  form.elements.pamphlet.value = "";
  $("eventFormHeading").textContent = `Edit event: ${event.title}`;
  $("eventSubmit").textContent = "Save event changes";
  $("cancelEdit").classList.remove("hidden");
  form.scrollIntoView({behavior:"smooth",block:"start"});
}
function resetEventEditor() {
  editingEventId = null;
  $("eventForm").reset();
  $("eventFormHeading").textContent = "Create an event";
  $("eventSubmit").textContent = "Publish event";
  $("cancelEdit").classList.add("hidden");
}
async function deleteEvent(id) {
  if (!confirm("Delete this event permanently? Its registrations will also be deleted.")) return;
  try {
    await api(`/events/${id}`, {method:"DELETE", headers:headers(false)});
    if (String(editingEventId) === String(id)) resetEventEditor();
    toast("Event deleted.");
    await loadDashboard();
    await loadEvents();
  } catch (e) { toast(e.message); }
}

async function loadDashboard() {
  if (!currentUser) return;
  showSection("dashboard");
  $("dashboardTitle").textContent = currentUser.role === "admin" ? "Admin dashboard" : `Hello, ${currentUser.name}`;
  $("dashboardSubtitle").textContent = currentUser.role === "admin" ? "Manage campus events and participants." : "Your campus activity at a glance.";
  $("studentPanel").classList.toggle("hidden", currentUser.role !== "student");
  $("adminPanel").classList.toggle("hidden", currentUser.role !== "admin");
  if (currentUser.role === "student") {
    const data = await api("/registrations/mine/list", {headers:headers(false)});
    $("stats").innerHTML = `<div class="stat-card"><small>My registrations</small><strong>${data.registrations.filter(r=>r.status!=="cancelled").length}</strong></div><div class="stat-card"><small>Attended</small><strong>${data.registrations.filter(r=>r.status==="attended").length}</strong></div><div class="stat-card"><small>Account</small><strong>Student</strong></div>`;
    $("myRegistrations").innerHTML = data.registrations.length ? `<table class="data-table"><thead><tr><th>Event</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>${data.registrations.map(r=>`<tr><td>${escapeHtml(r.title)}</td><td>${dateText(r.event_date)}</td><td>${escapeHtml(r.status)}</td><td>${r.status==="registered"?`<button class="btn btn-ghost cancel-reg" data-id="${r.registration_id}">Cancel</button>`:"—"}</td></tr>`).join("")}</tbody></table>` : "<p>No registrations yet. Explore events to get started.</p>";
    document.querySelectorAll(".cancel-reg").forEach(b=>b.addEventListener("click",()=>cancelRegistration(b.dataset.id)));
  } else {
    const [overview,events,students,registrations] = await Promise.all([
      api("/admin/overview",{headers:headers(false)}), api("/events"),
      api("/admin/students",{headers:headers(false)}), api("/registrations",{headers:headers(false)})
    ]);
    $("stats").innerHTML = `<div class="stat-card"><small>Students</small><strong>${overview.students}</strong></div><div class="stat-card"><small>Events</small><strong>${overview.events}</strong></div><div class="stat-card"><small>Registrations</small><strong>${overview.registrations}</strong></div>`;
    renderAdminEvents(events.events);
    $("studentList").innerHTML = `<table class="data-table"><thead><tr><th>Name</th><th>College email</th><th>Phone</th><th>Department</th><th>Year</th><th>Account created</th><th>Action</th></tr></thead><tbody>${students.students.map(s=>`<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.email)}</td><td>${escapeHtml(s.phone||"—")}</td><td>${escapeHtml(s.department||"—")}</td><td>${escapeHtml(s.year||"—")}</td><td>${dateText(s.created_at)}</td><td><button class="btn btn-ghost edit-student" data-id="${s.id}">Edit</button></td></tr>`).join("")}</tbody></table>`;
    $("studentList").querySelectorAll(".edit-student").forEach(b=>b.addEventListener("click",()=>openStudentEditor(students.students.find(s=>String(s.id)===b.dataset.id))));
    $("allRegistrations").innerHTML = table(["Student","College email","Event","Registered at","Status","Action"],registrations.registrations.map(r=>[r.name,r.email,r.event_title,dateText(r.registered_at),r.status,r.status==="registered"?`<button class="btn btn-ghost checkin" data-id="${r.id}">Check in</button>`:"—"]));
    document.querySelectorAll(".checkin").forEach(b=>b.addEventListener("click",()=>checkin(b.dataset.id)));
    const completed = events.events.filter(e=>new Date(e.event_date)<=new Date());
    await renderWinnerManager(completed);
  }
}
async function renderWinnerManager(completed) {
  const target = $("winnerManager");
  if (!completed.length) { target.innerHTML = "<p>No completed events yet. Winner entry becomes available after the event date.</p>"; return; }
  target.innerHTML = completed.map(e=>`<div class="panel"><strong>${escapeHtml(e.title)}</strong><p class="muted">Choose three different students who registered for this event. Their announcement will appear publicly and an email will be sent if SMTP is configured.</p><div class="winner-row" data-event="${e.id}"><select aria-label="First place" class="winner-select"><option value="">Loading registered students…</option></select><select aria-label="Second place" class="winner-select"><option value="">Loading registered students…</option></select><select aria-label="Third place" class="winner-select"><option value="">Loading registered students…</option></select><button class="btn btn-primary save-winners" data-id="${e.id}">Announce winners</button></div></div>`).join("");
  for (const e of completed) {
    const row = target.querySelector(`.winner-row[data-event="${e.id}"]`);
    try {
      const [participants, existing] = await Promise.all([api(`/admin/events/${e.id}/participants`,{headers:headers(false)}),api(`/events/${e.id}/winners`)]);
      const options = `<option value="">Select registered student</option>` + participants.participants.map(u=>`<option value="${u.id}">${escapeHtml(u.name)} — ${escapeHtml(u.email)}</option>`).join("");
      row.querySelectorAll("select").forEach(sel=>sel.innerHTML=options);
      existing.winners.forEach(w=>{ const sel=row.querySelectorAll("select")[w.position-1]; if(sel && w.winner_user_id) sel.value=String(w.winner_user_id); });
      if (!participants.participants.length) row.insertAdjacentHTML("beforeend",'<p class="muted span-two">No registered students are available for this event.</p>');
    } catch(err) { row.querySelectorAll("select").forEach(sel=>sel.innerHTML='<option value="">Could not load students</option>'); }
  }
  target.querySelectorAll(".save-winners").forEach(b=>b.addEventListener("click",()=>saveWinners(b.dataset.id)));
}
function openStudentEditor(student) {
  if (!student) return;
  const form = $("studentEditForm");
  for (const key of ["id","name","email","phone","department","year"]) form.elements[key].value = student[key] ?? "";
  form.elements.password.value = "";
  $("studentEditMessage").textContent = "";
  $("studentEditModal").classList.remove("hidden");
  form.elements.name.focus();
}
async function saveStudent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const id = data.id; delete data.id;
  if (!data.password) delete data.password;
  try {
    await api(`/admin/students/${id}`,{method:"PUT",headers:headers(),body:JSON.stringify(data)});
    $("studentEditModal").classList.add("hidden");
    toast("Student account updated.");
    await loadDashboard();
  } catch(err) { $("studentEditMessage").textContent=err.message; }
}

function table(headings, rows) {
  if (!rows.length) return "<p>No records found.</p>";
  return `<table class="data-table"><thead><tr>${headings.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${String(v).startsWith("<button")?v:escapeHtml(v ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
async function cancelRegistration(id) {
  if (!confirm("Cancel this registration?")) return;
  try { await api(`/registrations/${id}/cancel`,{method:"PATCH",headers:headers(),body:"{}"}); toast("Registration cancelled."); loadDashboard(); }
  catch(e){toast(e.message);}
}
async function checkin(id) {
  try { await api(`/registrations/${id}/checkin`,{method:"PATCH",headers:headers(),body:"{}"}); toast("Attendance marked."); loadDashboard(); }
  catch(e){toast(e.message);}
}
async function saveWinners(id) {
  const row = document.querySelector(`.winner-row[data-event="${id}"]`);
  const [firstUserId,secondUserId,thirdUserId] = [...row.querySelectorAll("select")].map(sel=>sel.value);
  try {
    const result = await api(`/admin/events/${id}/winners`,{method:"PUT",headers:headers(),body:JSON.stringify({firstUserId,secondUserId,thirdUserId})});
    toast(result.emailNotice || `Winners announced. ${result.emailsSent} email notification(s) sent.`);
    await loadDashboard();
    await loadEvents();
  } catch(e) { toast(e.message); }
}

$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const body = Object.fromEntries(f.entries());
  $("authSubmit").disabled = true;
  try {
    const result = await api(`/auth/${authMode}`,{method:"POST",headers:headers(),body:JSON.stringify(body)});
    saveSession(result);
    $("authModal").classList.add("hidden");
    e.currentTarget.reset();
    toast(authMode==="register" ? (result.emailSent?"Account created. Welcome email sent!":"Account created. Email is not configured.") : "Welcome back!");
    await loadDashboard();
  } catch(err) { $("authMessage").textContent=err.message; }
  finally { $("authSubmit").disabled=false; }
});
$("loginOpen").onclick=()=>openAuth("login");
$("registerOpen").onclick=()=>openAuth("register");
$("heroRegister").onclick=()=>openAuth("register");
$("modalClose").onclick=()=>$("authModal").classList.add("hidden");
$("logoutBtn").onclick=()=>{clearSession();showSection("home");toast("Logged out.");};
$("dashboardOpen").onclick=()=>loadDashboard();
$("quickDashboard").onclick=()=>loadDashboard();
$("dashboardHome").onclick=()=>showSection("home");
$("eventConfirmSubmit").onclick=confirmEventRegistration;
$("eventConfirmClose").onclick=$("eventConfirmCancel").onclick=()=>{pendingEvent=null;$("eventConfirmModal").classList.add("hidden");};
$("eventConfirmModal").addEventListener("click",e=>{if(e.target.id==="eventConfirmModal"){pendingEvent=null;e.currentTarget.classList.add("hidden");}});
$("exploreBtn").onclick=()=>{showSection("events");loadEvents();};
$("backHome").onclick=()=>showSection("home");
document.querySelector('a[href="#events"]').onclick=(e)=>{e.preventDefault();showSection("events");loadEvents();};
document.querySelector('a[href="#home"]').onclick=(e)=>{e.preventDefault();showSection("home");};
$("eventForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const method = editingEventId ? "PUT" : "POST";
  const endpoint = editingEventId ? `/events/${editingEventId}` : "/events";
  try {
    const response = await fetch(API + endpoint,{method,headers:{"Authorization":`Bearer ${token}`},body:form});
    const data = await response.json();
    if(!response.ok) throw new Error(data.error||"Could not save event.");
    toast(editingEventId ? "Event updated successfully." : "Event published successfully.");
    resetEventEditor();
    await loadDashboard();
    await loadEvents();
  } catch(err){toast(err.message);}
});
$("cancelEdit").addEventListener("click", resetEventEditor);
$("studentEditForm").addEventListener("submit", saveStudent);
$("studentEditClose").addEventListener("click", ()=>$("studentEditModal").classList.add("hidden"));
$("studentEditModal").addEventListener("click", e=>{ if(e.target.id==="studentEditModal") e.currentTarget.classList.add("hidden"); });
updateNav();
if (token && currentUser) {
  api("/auth/me",{headers:headers(false)}).then(data=>{currentUser=data.user;localStorage.setItem("eh_user",JSON.stringify(currentUser));updateNav();loadDashboard();})
    .catch(()=>{clearSession();showSection("home");});
} else { showSection("home"); }
