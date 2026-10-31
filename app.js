(() => {
  "use strict";

  // CircleUp Supabase connection. The publishable key is designed for browser use.
  const SUPABASE_URL = "https://covfeljgcxlhqhupfdwa.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_ERIExAXoWETwTYLy2NNv7Q_loclh1FE";

  const $ = id => document.getElementById(id);
  const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
  const parseSkills = s => [...new Set(String(s || "").split(",").map(x => x.trim()).filter(Boolean).map(x => x.slice(0,45)))].slice(0,12);
  const initials = n => String(n || "?").trim().split(/\s+/).map(x => x[0]).slice(0,2).join("").toUpperCase();
  const toast = s => {
    $("toast").textContent = s;
    $("toast").classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => $("toast").classList.remove("show"), 3000);
  };

  if (!window.supabase?.createClient) {
    $("authMessage").textContent = "Could not load the Supabase library. Refresh the page and try again.";
    return;
  }

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let user = null, profile = null, people = [], requests = [], tab = "all", current = null;
  let skillCatalog = [];

  function setAuthMode(mode) {
    const signup = mode === "signup";
    $("authHeading").textContent = signup ? "Create your student account" : "Welcome back";
    $("authSubmit").textContent = signup ? "Create account" : "Log in";
    $("authToggle").textContent = signup ? "I already have an account" : "Create a new account";
    $("authNameField").classList.toggle("hidden", !signup);
    $("authPassword").autocomplete = signup ? "new-password" : "current-password";
    $("authMessage").textContent = "";
    $("authForm").dataset.mode = mode;
  }

  function showSignedInUI() {
    $("authGate").classList.add("hidden");
    $("appArea").classList.remove("hidden");
    $("signedInAs").textContent = user?.email || "";
  }

  function showSignedOutUI() {
    $("appArea").classList.add("hidden");
    $("authGate").classList.remove("hidden");
    user = null; profile = null; people = []; requests = [];
    setAuthMode("signup");
  }

  async function loadProfile() {
    const { data, error } = await db.from("profiles").select("*").eq("id", user.id).single();
    if (error) throw error;
    profile = {
      id: data.id,
      name: data.display_name || user.email?.split("@")[0] || "Student",
      branch: data.branch || "Other",
      year: data.study_year || "Other",
      bio: data.bio || "",
      format: data.preferred_format || "Both",
      offers: [], wants: []
    };
    const { data: links, error: linksError } = await db
      .from("student_skills")
      .select("skill_type, skills(name)")
      .eq("student_id", user.id);
    if (linksError) throw linksError;
    (links || []).forEach(row => {
      const name = row.skills?.name;
      if (!name) return;
      if (row.skill_type === "offer") profile.offers.push(name);
      if (row.skill_type === "want") profile.wants.push(name);
    });
  }

  async function loadSkills() {
    const { data, error } = await db.from("skills").select("id,name").order("name");
    if (error) throw error;
    skillCatalog = data || [];
    const hint = $("skillCatalogHint");
    if (hint) hint.textContent = skillCatalog.length
      ? "Available skills: " + skillCatalog.map(x => x.name).join(", ")
      : "No skills are available yet. Ask the project admin to add skills in Supabase.";
  }

  async function loadPeople() {
    const { data: profiles, error } = await db.from("profiles").select("*").neq("id", user.id);
    if (error) throw error;
    const ids = (profiles || []).map(p => p.id);
    let links = [];
    if (ids.length) {
      const result = await db.from("student_skills").select("student_id,skill_type,skills(name)").in("student_id", ids);
      if (result.error) throw result.error;
      links = result.data || [];
    }
    people = (profiles || []).map(p => {
      const mine = links.filter(x => x.student_id === p.id);
      return {
        id: p.id,
        name: p.display_name || "CircleUp student",
        branch: p.branch || "Other",
        year: p.study_year || "Other",
        bio: p.bio || "",
        format: p.preferred_format || "Both",
        offers: mine.filter(x => x.skill_type === "offer").map(x => x.skills?.name).filter(Boolean),
        wants: mine.filter(x => x.skill_type === "want").map(x => x.skills?.name).filter(Boolean)
      };
    });
  }

  async function loadRequests() {
    const { data, error } = await db.from("exchange_requests").select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    requests = (data || []).map(r => ({
      id: r.id,
      senderId: r.sender_id,
      recipientId: r.recipient_id,
      personId: r.sender_id === user.id ? r.recipient_id : r.sender_id,
      topic: r.topic,
      offer: r.offer,
      format: r.preferred_format,
      message: r.message,
      status: r.status,
      createdAt: new Date(r.created_at).getTime(),
      direction: r.sender_id === user.id ? "sent" : "received"
    }));
  }

  async function refreshAll() {
    await loadProfile();
    await loadSkills();
    await loadPeople();
    await loadRequests();
    fillForm();
    profilePreview();
    matches();
    renderRequests();
    showSignedInUI();
  }

  async function saveProfile() {
    const name = $("name").value.trim();
    const branch = $("branchProfile").value;
    const year = $("year").value;
    const bio = $("bio").value.trim();
    const format = $("format").value;
    const offers = parseSkills($("offers").value);
    const wants = parseSkills($("wants").value);
    if (!name || !offers.length || !wants.length) {
      toast("Add your display name and at least one skill in each list.");
      return;
    }

    const { error: profileError } = await db.from("profiles").upsert({
      id: user.id, display_name: name, branch, study_year: year, bio, preferred_format: format
    });
    if (profileError) throw profileError;

    const names = [...new Set([...offers, ...wants])];
    let idsByName = new Map(skillCatalog.map(s => [norm(s.name), s.id]));
    for (const skillName of names) {
      if (!idsByName.has(norm(skillName))) {
        const existing = await db.from("skills").select("id,name").ilike("name", skillName).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) idsByName.set(norm(existing.data.name), existing.data.id);
        else {
          // The starter catalogue is read-only to regular users. Ask the user to choose catalogue skills.
          throw new Error(`"${skillName}" is not in the current skill catalogue. Please use a listed skill or ask the project admin to add it.`);
        }
      }
    }

    const { error: deleteError } = await db.from("student_skills").delete().eq("student_id", user.id);
    if (deleteError) throw deleteError;

    const rows = [
      ...offers.map(name => ({ student_id: user.id, skill_id: idsByName.get(norm(name)), skill_type: "offer" })),
      ...wants.map(name => ({ student_id: user.id, skill_id: idsByName.get(norm(name)), skill_type: "want" }))
    ];
    const { error: insertError } = await db.from("student_skills").insert(rows);
    if (insertError) throw insertError;

    await refreshAll();
    navigate("discover");
    toast("Your profile is saved and visible to CircleUp students.");
  }

  function overlap(a, b) {
    const set = new Set(b.map(norm));
    return a.filter(x => set.has(norm(x)));
  }
  function match(p) {
    const out = overlap(profile.wants, p.offers);
    const back = overlap(profile.offers, p.wants);
    const reciprocal = (out.length / Math.max(1, profile.wants.length) + back.length / Math.max(1, profile.offers.length)) / 2;
    const fmt = profile.format === "Both" || p.format === "Both" || profile.format === p.format ? 1 : .45;
    const cross = profile.branch === p.branch ? .5 : 1;
    return { out, back, score: Math.round(Math.min(1, .78 * reciprocal + .12 * fmt + .10 * cross) * 100) };
  }

  function personAvatar(p) {
    return `<div class="avatar">${esc(initials(p.name))}</div>`;
  }

  function matches() {
    const q = norm($("search").value), branch = $("branch").value, sort = $("sort").value;
    const list = people.map(p => ({ ...p, m: match(p) }))
      .filter(p => (branch === "all" || p.branch === branch) &&
        (!q || [p.name, p.branch, ...p.offers, ...p.wants].some(s => norm(s).includes(q))));
    list.sort(sort === "branch" ? (a,b) => a.branch.localeCompare(b.branch) : (a,b) => b.m.score - a.m.score);
    $("matches").innerHTML = list.map(p => {
      const learn = p.m.out[0] || p.offers[0] || "A skill they offer";
      const teach = p.m.back[0] || profile.offers[0] || "A skill you offer";
      const reason = p.m.out.length || p.m.back.length
        ? `You can learn <b>${esc(learn)}</b> from ${esc(p.name.split(" ")[0])}, while they can learn <b>${esc(teach)}</b> from you.`
        : `Explore a possible connection with ${esc(p.name.split(" ")[0])}. Add complementary skills to improve your mutual fit.`;
      return `<article class="card"><div class="person-head">${personAvatar(p)}<div><h3>${esc(p.name)}</h3><p>${esc(p.year)} · ${esc(p.branch)}</p></div><div class="score">${p.m.score}% fit</div></div><p class="reason">${reason}</p><div class="skillrow"><div class="skill"><small>THEY CAN TEACH</small><b>${esc(learn)}</b></div><div class="skill want"><small>THEY WANT TO LEARN</small><b>${esc(teach)}</b></div></div><div class="cardfoot"><span class="muted">${esc(p.branch)} · ${esc(p.format)}</span><button class="btn" data-connect="${esc(p.id)}">Connect →</button></div></article>`;
    }).join("");
    $("noMatches").classList.toggle("hidden", list.length > 0);
    $("matchCount").textContent = list.length;
    $("skillCount").textContent = profile.offers.length;
    $("activeCount").textContent = requests.filter(r => r.status === "accepted").length;
  }

  function profilePreview() {
    $("prevName").textContent = profile.name;
    $("prevBranch").textContent = `${profile.branch} · ${profile.year}`;
    $("prevBio").textContent = profile.bio || "Ready to share knowledge and learn new skills.";
    $("avatar").textContent = initials(profile.name);
    $("prevOffers").innerHTML = profile.offers.map(s => `<span class="tag">${esc(s)}</span>`).join("");
    $("prevWants").innerHTML = profile.wants.map(s => `<span class="tag green">${esc(s)}</span>`).join("");
  }
  function fillForm() {
    $("name").value = profile.name;
    $("branchProfile").value = profile.branch;
    $("year").value = profile.year;
    $("bio").value = profile.bio;
    $("offers").value = profile.offers.join(", ");
    $("wants").value = profile.wants.join(", ");
    $("format").value = profile.format;
  }
  function renderRequests() {
    const list = requests.filter(r => tab === "all" || r.status === tab);
    ["all","pending","accepted","completed"].forEach(s => {
      const el = $("count" + s[0].toUpperCase() + s.slice(1));
      if (el) el.textContent = requests.filter(r => s === "all" || r.status === s).length;
    });
    $("noRequests").classList.toggle("hidden", requests.length > 0);
    $("requests").classList.toggle("hidden", list.length === 0);
    $("requests").innerHTML = list.map(r => {
      const other = people.find(p => p.id === r.personId) || { name: "CircleUp student" };
      const canRespond = r.direction === "received" && r.status === "pending";
      const actions = canRespond
        ? `<button class="btn" data-action="accept" data-id="${esc(r.id)}">Accept</button><button class="btn secondary" data-action="decline" data-id="${esc(r.id)}">Decline</button>`
        : r.direction === "sent" && r.status === "pending"
          ? `<button class="btn secondary" data-action="cancel" data-id="${esc(r.id)}">Cancel request</button>`
          : r.status === "accepted"
            ? `<button class="btn" data-action="complete" data-id="${esc(r.id)}">Mark completed</button>` : "";
      const statusLabel = ({pending:"Awaiting response",accepted:"Exchange accepted",completed:"Completed",declined:"Declined",cancelled:"Cancelled"})[r.status] || r.status;
      const directionLabel = r.direction === "sent" ? "You sent this request" : "You received this request";
      return `<article class="card request">${personAvatar(other)}<main><h3>Skill exchange with ${esc(other.name)}</h3><p class="muted">${esc(directionLabel)}<br><b>Learn:</b> ${esc(r.topic)} · <b>Share:</b> ${esc(r.offer)}<br>Format: ${esc(r.format)}${r.message ? `<br>${esc(r.message)}` : ""}</p><span class="status ${esc(r.status)}">${esc(statusLabel)}</span><div class="actions">${actions}</div></main></article>`;
    }).join("");
  }

  function navigate(id) {
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === id));
    if (id === "profile") { fillForm(); profilePreview(); }
    if (id === "exchanges") renderRequests();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openRequest(id) {
    current = people.find(p => p.id === id);
    if (!current) return;
    const m = match(current);
    $("modalTitle").textContent = `Connect with ${current.name.split(" ")[0]}`;
    $("modalWhy").textContent = `You can learn ${m.out[0] || current.offers[0] || "a skill"} from them and share ${m.back[0] || profile.offers[0] || "your skills"} in return.`;
    $("topic").value = m.out[0] || current.offers[0] || "";
    $("offer").value = m.back[0] || profile.offers[0] || "";
    $("reqFormat").value = current.format === "Online" ? "Online" : current.format === "In-person" ? "In-person in a public campus space" : "Either works";
    $("message").value = "";
    $("modalbg").classList.remove("hidden");
  }
  function closeModal() { $("modalbg").classList.add("hidden"); current = null; }

  async function updateRequest(id, action) {
    const r = requests.find(x => x.id === id);
    if (!r) return;
    let status;
    if (action === "accept") status = "accepted";
    if (action === "decline") status = "declined";
    if (action === "cancel") status = "cancelled";
    if (action === "complete") status = "completed";
    if (!status) return;
    const { error } = await db.from("exchange_requests").update({ status }).eq("id", id);
    if (error) throw error;
    await loadRequests();
    matches();
    renderRequests();
    toast("Exchange request updated.");
  }

  $("authToggle").addEventListener("click", () =>
    setAuthMode($("authForm").dataset.mode === "signup" ? "login" : "signup"));

  $("authForm").addEventListener("submit", async e => {
    e.preventDefault();
    const mode = $("authForm").dataset.mode || "signup";
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    $("authSubmit").disabled = true;
    $("authMessage").textContent = "Please wait…";
    try {
      if (mode === "signup") {
        const displayName = $("authName").value.trim();
        const { data, error } = await db.auth.signUp({
          email, password,
          options: { data: { display_name: displayName } }
        });
        if (error) throw error;
        if (!data.session) {
          $("authMessage").textContent = "Account created. Check your email for the confirmation link, then return here and log in.";
          setAuthMode("login");
          $("authEmail").value = email;
        } else {
          user = data.user;
          await refreshAll();
          toast("Welcome to CircleUp!");
        }
      } else {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        user = data.user;
        await refreshAll();
        toast("You are signed in.");
      }
    } catch (err) {
      $("authMessage").textContent = err.message || "Something went wrong. Please try again.";
    } finally {
      $("authSubmit").disabled = false;
    }
  });

  $("signOut").addEventListener("click", async () => {
    const { error } = await db.auth.signOut();
    if (error) return toast(error.message);
    showSignedOutUI();
  });

  $("profileForm").addEventListener("submit", async e => {
    e.preventDefault();
    try { await saveProfile(); }
    catch (err) { toast(err.message || "Could not save your profile."); }
  });

  $("requestForm").addEventListener("submit", async e => {
    e.preventDefault();
    if (!current) return;
    if (requests.some(r => r.personId === current.id && ["pending","accepted"].includes(r.status))) {
      closeModal(); toast("You already have an active exchange with this student."); return;
    }
    try {
      const { error } = await db.from("exchange_requests").insert({
        sender_id: user.id,
        recipient_id: current.id,
        topic: $("topic").value.trim(),
        offer: $("offer").value.trim(),
        preferred_format: $("reqFormat").value,
        message: $("message").value.trim(),
        status: "pending"
      });
      if (error) throw error;
      closeModal();
      await loadRequests();
      matches(); renderRequests(); navigate("exchanges");
      toast("Exchange request sent.");
    } catch (err) { toast(err.message || "Could not send the request."); }
  });

  document.addEventListener("click", async e => {
    const go = e.target.closest("[data-go]");
    if (go) { navigate(go.dataset.go); return; }
    const connect = e.target.closest("[data-connect]");
    if (connect) { openRequest(connect.dataset.connect); return; }
    const t = e.target.closest("[data-tab]");
    if (t) {
      tab = t.dataset.tab;
      document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("active", x === t));
      renderRequests(); return;
    }
    const action = e.target.closest("[data-action]");
    if (action) {
      try { await updateRequest(action.dataset.id, action.dataset.action); }
      catch (err) { toast(err.message || "Could not update the request."); }
    }
  });

  $("search").addEventListener("input", matches);
  $("branch").addEventListener("change", matches);
  $("sort").addEventListener("change", matches);
  $("close").addEventListener("click", closeModal);
  $("modalbg").addEventListener("click", e => { if (e.target === $("modalbg")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

  db.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) { showSignedOutUI(); return; }
    user = session.user;
    try { await refreshAll(); }
    catch (err) { toast(err.message || "Could not load CircleUp data."); }
  });

  (async function start() {
    setAuthMode("signup");
    const { data, error } = await db.auth.getSession();
    if (error) { $("authMessage").textContent = error.message; return; }
    if (data.session?.user) {
      user = data.session.user;
      try { await refreshAll(); }
      catch (err) { toast(err.message || "Could not load your profile."); }
    } else showSignedOutUI();
  })();
})();
