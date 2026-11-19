(() => {
  "use strict";

  const config = window.STORE_CONFIG || {};
  const homeView = document.querySelector("#home-view");
  const loginView = document.querySelector("#login-view");
  const storeView = document.querySelector("#store-view");
  const loginOpen = document.querySelector("#login-open");
  const loginForm = document.querySelector("#login-form");
  const loginMessage = document.querySelector("#login-message");
  const forgotPasswordButton = document.querySelector("#forgot-password");
  const accountArea = document.querySelector("#account-area");
  const catalog = document.querySelector("#catalog");
  const emptyState = document.querySelector("#empty-state");
  const searchInput = document.querySelector("#search");
  const appCount = document.querySelector("#app-count");
  const userGreeting = document.querySelector("#user-greeting");
  const firstName = document.querySelector("#first-name");
  const adminPanel = document.querySelector("#admin-panel");
  const appForm = document.querySelector("#app-form");
  const adminMessage = document.querySelector("#admin-message");
  const adminAppList = document.querySelector("#admin-app-list");
  const appsMessage = document.querySelector("#apps-manager-message");
  const deviceList = document.querySelector("#device-list");
  const devicesMessage = document.querySelector("#devices-message");
  const accessForm = document.querySelector("#access-form");
  const accessAppSelect = document.querySelector("#access-app");
  const accessMessage = document.querySelector("#access-message");
  const accessList = document.querySelector("#access-list");
  const accessUserFilter = document.querySelector("#access-user-filter");
  const accessUserOptions = document.querySelector("#access-user-options");
  const accessListHeading = document.querySelector("#access-list-heading");
  const inviteForm = document.querySelector("#invite-form");
  const inviteMessage = document.querySelector("#invite-message");
  const welcomePassword = document.querySelector("#welcome-password");
  const storeContent = document.querySelector("#store-content");
  const passwordForm = document.querySelector("#password-form");
  const passwordMessage = document.querySelector("#password-message");
  const publicCatalog = document.querySelector("#public-catalog");
  const publicEmpty = document.querySelector("#public-empty");
  const publicSearch = document.querySelector("#public-search");
  const publicEmptyText = publicEmpty.querySelector("p");
  const platformSelect = document.querySelector("#app-platform");
  const apkField = document.querySelector("#apk-field");
  const apkInput = document.querySelector("#app-file");
  const iosLinkField = document.querySelector("#ios-link-field");
  const iosLinkInput = document.querySelector("#app-install-url");
  const toast = document.querySelector("#toast");
  const APK_BUCKET = "private-apks";
  const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;
  let slugSupported = false;
  let devicesSupported = false;
  let adminDevices = [];
  const deviceDateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const APK_MAX_SIZE = 50 * 1024 * 1024; // limite par fichier de l’offre gratuite Supabase
  let supabaseClient;
  let applications = [];
  let adminApplications = [];
  let publicApplications = [];
  let clientAccessEntries = [];
  let currentUserId = null;
  let pendingAuthMessage = "";
  let toastTimer;

  function setMessage(element, message, success) {
    element.textContent = message;
    element.classList.toggle("success", Boolean(success));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 4000);
  }

  function getPageUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  // Erreurs renvoyées par Supabase dans l’URL (lien expiré, déjà utilisé…).
  function consumeAuthRedirectError() {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const hasError = (params) => params.has("error") || params.has("error_code") || params.has("error_description");
    const source = hasError(hashParams) ? hashParams : hasError(queryParams) ? queryParams : null;
    if (!source) return "";
    const code = source.get("error_code") || "";
    const error = source.get("error") || "";
    console.warn("Authentication redirect error:", error, code, source.get("error_description"));
    window.history.replaceState({}, "", window.location.pathname);
    if (code === "otp_expired") {
      return "Ce lien a expiré ou a déjà été utilisé. Demandez une nouvelle invitation ou utilisez « Mot de passe oublié ? ».";
    }
    if (error === "access_denied") {
      return "L’accès a été refusé : le lien n’est plus valide. Demandez un nouveau lien ou contactez-nous.";
    }
    return "Le lien utilisé n’est pas valide. Réessayez ou contactez-nous.";
  }

  async function getFunctionErrorMessage(error, fallback) {
    const response = error && error.context;
    if (response && typeof response.json === "function") {
      try {
        const body = await response.clone().json();
        if (body && typeof body.error === "string" && body.error.trim()) return body.error.trim();
      } catch (parseError) {
        console.warn("Could not read function error body:", parseError);
      }
    }
    return fallback;
  }

  function configureSupabase() {
    if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
      setMessage(loginMessage, "Le portail n’est pas encore configuré. Contactez votre administrateur.", false);
      loginForm.querySelector("button[type=submit]").disabled = true;
      forgotPasswordButton.disabled = true;
      publicEmpty.hidden = false;
      publicEmptyText.textContent = "Le catalogue sera disponible dès que le portail aura été configuré.";
      return false;
    }
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return true;
  }

  function showHome() {
    homeView.hidden = false;
    loginView.hidden = true;
    storeView.hidden = true;
    loginOpen.hidden = false;
    accountArea.hidden = true;
  }

  function showLogin() {
    homeView.hidden = true;
    loginView.hidden = false;
    storeView.hidden = true;
    loginOpen.hidden = true;
    accountArea.hidden = true;
    document.querySelector("#email").focus();
  }

  // Efface toutes les données de la session précédente affichées dans la page.
  function clearSignedInState() {
    currentUserId = null;
    applications = [];
    adminApplications = [];
    clientAccessEntries = [];
    catalog.replaceChildren();
    adminAppList.replaceChildren();
    adminDevices = [];
    deviceList.replaceChildren();
    accessList.replaceChildren();
    accessUserOptions.replaceChildren();
    accessAppSelect.replaceChildren(new Option("Choisir une application…", ""));
    accessListHeading.hidden = true;
    accessListHeading.textContent = "";
    for (const form of [loginForm, inviteForm, appForm, accessForm, passwordForm]) form.reset();
    platformSelect.dispatchEvent(new Event("change"));
    searchInput.value = "";
    accessUserFilter.value = "";
    for (const message of [loginMessage, inviteMessage, adminMessage, appsMessage, accessMessage, passwordMessage, devicesMessage]) {
      setMessage(message, "", false);
    }
    userGreeting.textContent = "";
    firstName.textContent = "";
    appCount.textContent = "0";
    emptyState.hidden = true;
    adminPanel.hidden = true;
    welcomePassword.hidden = true;
    storeContent.hidden = false;
  }

  function showSignedOut(message = "") {
    clearSignedInState();
    if (message) {
      showLogin();
      setMessage(loginMessage, message, false);
    } else {
      showHome();
    }
  }

  function getInitial(name) {
    return (name || "?").trim().charAt(0).toLocaleUpperCase("fr");
  }

  function getPlatformLabel(platform) {
    return platform === "ios" ? "iPhone / iPad" : "Android";
  }

  function renderPublicCatalog() {
    const query = publicSearch.value.trim().toLocaleLowerCase("fr");
    const matching = publicApplications.filter((app) =>
      `${app.name} ${app.description}`.toLocaleLowerCase("fr").includes(query)
    );
    publicCatalog.replaceChildren();
    publicEmpty.hidden = matching.length > 0;
    if (!matching.length && query) {
      publicEmptyText.textContent = "Aucune application ne correspond à votre recherche.";
    } else if (!matching.length) {
      publicEmptyText.textContent = publicApplications.length
        ? "Aucune application n’est disponible pour le moment."
        : "De nouvelles applis arrivent bientôt. Revenez nous voir prochainement.";
    }

    for (const app of matching) {
      const card = document.createElement("article");
      card.className = "app-card";
      const top = document.createElement("div");
      top.className = "app-card-top";
      const icon = document.createElement("div");
      icon.className = "app-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = getInitial(app.name);
      const platform = document.createElement("span");
      platform.className = "platform-tag";
      platform.textContent = getPlatformLabel(app.platform);
      top.append(icon, platform);
      const title = document.createElement("h3");
      title.textContent = app.name;
      const description = document.createElement("p");
      description.className = "app-description";
      description.textContent = app.description;
      const bottom = document.createElement("div");
      bottom.className = "app-card-bottom";
      const version = document.createElement("span");
      version.className = "app-version";
      version.textContent = `Version ${app.version}`;
      const loginButton = document.createElement("button");
      loginButton.type = "button";
      loginButton.className = "button button-quiet download-button";
      loginButton.textContent = "Connexion requise";
      loginButton.addEventListener("click", showLogin);
      bottom.append(version, loginButton);
      card.append(top, title, description, bottom);
      publicCatalog.append(card);
    }
  }

  async function loadPublicCatalog() {
    const { data, error } = await supabaseClient.rpc("get_public_apps");
    if (error) throw error;
    publicApplications = data || [];
    renderPublicCatalog();
  }

  function renderCatalog() {
    const query = searchInput.value.trim().toLocaleLowerCase("fr");
    const matching = applications.filter((app) =>
      `${app.name} ${app.description}`.toLocaleLowerCase("fr").includes(query)
    );
    appCount.textContent = String(matching.length);
    catalog.replaceChildren();
    emptyState.hidden = matching.length > 0;

    for (const app of matching) {
      const card = document.createElement("article");
      card.className = "app-card";

      const top = document.createElement("div");
      top.className = "app-card-top";
      const icon = document.createElement("div");
      icon.className = "app-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = getInitial(app.name);
      const platform = document.createElement("span");
      platform.className = "platform-tag";
      platform.textContent = getPlatformLabel(app.platform);
      top.append(icon, platform);

      const title = document.createElement("h3");
      title.textContent = app.name;
      const description = document.createElement("p");
      description.className = "app-description";
      description.textContent = app.description;

      const bottom = document.createElement("div");
      bottom.className = "app-card-bottom";
      const version = document.createElement("span");
      version.className = "app-version";
      version.textContent = `Version ${app.version}`;
      const download = document.createElement("button");
      download.type = "button";
      download.className = app.hasAccess
        ? "button button-primary download-button"
        : "button button-quiet download-button";
      if (app.hasAccess) {
        download.textContent = app.platform === "ios" ? "Ouvrir l’installation" : "Télécharger";
        download.addEventListener("click", () => downloadApplication(app, download));
      } else {
        download.textContent = "Accès non acheté";
        download.disabled = true;
        const accessNote = document.createElement("p");
        accessNote.className = "muted";
        accessNote.textContent = "Contactez l’administrateur pour acheter cette application et obtenir l’accès.";
        card.append(accessNote);
      }
      bottom.append(version, download);
      card.append(top, title, description, bottom);
      catalog.append(card);
    }
  }

  async function loadCatalog() {
    catalog.replaceChildren();
    const [accessibleResult, publicResult] = await Promise.all([
      supabaseClient
        .from("store_apps")
        .select("id, name, description, version, platform, install_url")
        .order("created_at", { ascending: false }),
      supabaseClient.rpc("get_public_apps")
    ]);
    if (accessibleResult.error) throw accessibleResult.error;
    if (publicResult.error) throw publicResult.error;
    // Les liens de téléchargement proviennent uniquement de la requête protégée par RLS.
    const accessible = new Map((accessibleResult.data || []).map((app) => [app.id, app]));
    applications = (publicResult.data || []).map((app) => ({
      ...app,
      ...(accessible.get(app.id) || {}),
      hasAccess: accessible.has(app.id)
    }));
    // Inclut aussi les applications non publiées visibles des administrateurs.
    const publishedIds = new Set(applications.map((app) => app.id));
    for (const app of accessible.values()) {
      if (!publishedIds.has(app.id)) applications.push({ ...app, hasAccess: true });
    }
    renderCatalog();
  }

  async function showSignedIn(session, { forcePassword = false } = {}) {
    currentUserId = session.user.id;
    homeView.hidden = true;
    loginView.hidden = true;
    storeView.hidden = false;
    loginOpen.hidden = true;
    accountArea.hidden = false;
    const params = new URLSearchParams(window.location.search);
    const needsPassword = forcePassword || params.get("welcome") === "1" || params.get("recovery") === "1";
    welcomePassword.hidden = !needsPassword;
    storeContent.hidden = needsPassword;
    const email = session.user.email || "";
    userGreeting.textContent = email;
    if (needsPassword) {
      adminPanel.hidden = true;
      document.querySelector("#new-password").focus();
      return;
    }
    const name = email.split("@")[0].split(/[._-]/)[0];
    firstName.textContent = name ? ` ${name}` : "";
    await loadCatalog();

    const { data, error } = await supabaseClient.rpc("is_store_admin");
    if (error) throw error;
    adminPanel.hidden = data !== true;
    if (data === true) {
      await loadAdminApps();
      await loadAccessManager();
    }
  }

  // ---------- Administration : gestion des applications ----------

  function validateApk(file) {
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".apk")) {
      return "Choisissez un fichier APK valide.";
    }
    if (file.size > APK_MAX_SIZE) return "Le fichier dépasse la limite de 50 Mo (offre gratuite Supabase).";
    return "";
  }

  async function uploadApk(file) {
    const path = `${crypto.randomUUID()}/${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabaseClient.storage
      .from(APK_BUCKET)
      .upload(path, file, {
        contentType: "application/vnd.android.package-archive",
        upsert: false
      });
    if (error) throw error;
    return path;
  }

  // Renvoie true si le fichier a bien été supprimé du bucket.
  async function removeApk(path) {
    if (!path) return true;
    const { data, error } = await supabaseClient.storage.from(APK_BUCKET).remove([path]);
    if (error || !data || !data.length) {
      console.error("Could not remove APK file:", path, error);
      return false;
    }
    return true;
  }

  async function loadAdminApps() {
    // Les colonnes « slug » (migration 002) et « max_devices » (migration 003)
    // peuvent manquer si les migrations n'ont pas encore été exécutées.
    const base = "id, name, version, platform, published, storage_path";
    const attempts = [
      { columns: `${base}, slug, max_devices`, slug: true, devices: true },
      { columns: `${base}, slug`, slug: true, devices: false },
      { columns: base, slug: false, devices: false }
    ];
    let data = null;
    let error = null;
    for (const attempt of attempts) {
      ({ data, error } = await supabaseClient
        .from("store_apps")
        .select(attempt.columns)
        .order("created_at", { ascending: false }));
      if (!error) {
        slugSupported = attempt.slug;
        devicesSupported = attempt.devices;
        break;
      }
      if (error.code !== "42703") break;
    }
    if (error) throw error;
    adminApplications = data || [];
    renderAdminApps();
  }

  async function refreshAdminData() {
    await Promise.all([loadCatalog(), loadAdminApps()]);
    await Promise.all([loadAccessManager(), loadDevices()]);
  }

  async function loadDevices() {
    deviceList.replaceChildren();
    if (!devicesSupported) {
      adminDevices = [];
      setMessage(devicesMessage, "Pour limiter les appareils, exécutez la migration 003 dans Supabase.", false);
      return;
    }
    const { data, error } = await supabaseClient
      .from("store_app_devices")
      .select("id, email, device_label, status, first_seen, last_seen, app_id, store_apps(name)")
      .order("last_seen", { ascending: false });
    if (error) {
      console.error("Could not load devices:", error);
      setMessage(devicesMessage, "La liste des appareils n’a pas pu être chargée.", false);
      return;
    }
    setMessage(devicesMessage, "", false);
    adminDevices = (data || []).sort((a, b) => {
      if (a.status !== b.status) return a.status === "refused" ? -1 : 1;
      return String(b.last_seen).localeCompare(String(a.last_seen));
    });
    renderDevices();
  }

  function formatDeviceDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : deviceDateFormat.format(date);
  }

  function renderDevices() {
    deviceList.replaceChildren();
    if (!adminDevices.length) {
      const empty = document.createElement("p");
      empty.className = "access-empty";
      empty.textContent = "Aucun appareil enregistré pour le moment. Ils apparaîtront à la première connexion d’un client dans une application protégée.";
      deviceList.append(empty);
      return;
    }
    for (const device of adminDevices) {
      const row = document.createElement("div");
      row.className = "access-row admin-app-row";
      const info = document.createElement("div");
      info.className = "access-row-info";
      const email = document.createElement("strong");
      email.textContent = device.email;
      const meta = document.createElement("span");
      meta.className = "admin-app-meta";
      const details = document.createElement("span");
      const appName = device.store_apps && device.store_apps.name ? device.store_apps.name : "Application supprimée";
      details.textContent = `${appName} · ${device.device_label || "Appareil inconnu"} · 1re connexion ${formatDeviceDate(device.first_seen)} · dernière ${formatDeviceDate(device.last_seen)}`;
      const status = document.createElement("span");
      const refused = device.status === "refused";
      status.className = refused ? "app-status refused" : "app-status published";
      status.textContent = refused ? "Refusé : appareil en trop" : "Actif";
      meta.append(details, status);
      info.append(email, meta);
      const actions = document.createElement("div");
      actions.className = "admin-app-actions";
      actions.append(createAdminButton(refused ? "Effacer" : "Retirer", "access-revoke", () => removeDevice(device, row)));
      row.append(info, actions);
      deviceList.append(row);
    }
  }

  async function removeDevice(device, row) {
    const refused = device.status === "refused";
    const confirmed = window.confirm(refused
      ? `Effacer cette tentative refusée de ${device.email} ?`
      : `Retirer cet appareil de ${device.email} ?\nL’application s’y bloquera à la prochaine vérification, et le client pourra l’utiliser sur un nouvel appareil.`);
    if (!confirmed) return;
    setRowBusy(row, true);
    const { data, error } = await supabaseClient
      .from("store_app_devices")
      .delete()
      .eq("id", device.id)
      .select("id");
    if (error || !data || !data.length) {
      console.error("Could not remove device:", error);
      setMessage(devicesMessage, "L’appareil n’a pas pu être retiré. Réessayez.", false);
      setRowBusy(row, false);
      return;
    }
    setMessage(devicesMessage, refused ? "Tentative effacée." : `Appareil retiré. ${device.email} peut maintenant se connecter sur un nouvel appareil.`, true);
    await loadDevices();
  }

  async function editMaxDevices(app, row) {
    const answer = window.prompt(
      `Nombre d’appareils autorisés par client pour « ${app.name} » (1 à 10) :`,
      String(app.max_devices || 1)
    );
    if (answer === null) return;
    const value = Number(answer.trim());
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      setMessage(appsMessage, "Indiquez un nombre entier entre 1 et 10.", false);
      return;
    }
    setRowBusy(row, true);
    const { data, error } = await supabaseClient
      .from("store_apps")
      .update({ max_devices: value })
      .eq("id", app.id)
      .select("id");
    if (error || !data || !data.length) {
      console.error("Could not change max devices:", error);
      setMessage(appsMessage, "La limite d’appareils n’a pas pu être modifiée. Réessayez.", false);
      setRowBusy(row, false);
      return;
    }
    setMessage(appsMessage, `« ${app.name} » : ${value} appareil${value > 1 ? "s" : ""} par client.`, true);
    await refreshAfterAdminChange();
  }

  async function refreshAfterAdminChange() {
    try {
      await refreshAdminData();
    } catch (error) {
      console.error("Could not refresh admin data:", error);
      showToast("La modification est enregistrée, mais la liste n’a pas pu être actualisée.");
    }
  }

  function setRowBusy(row, busy) {
    row.querySelectorAll("button").forEach((button) => {
      button.disabled = busy;
    });
  }

  function createAdminButton(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button admin-app-button ${className}`;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function renderAdminApps() {
    adminAppList.replaceChildren();
    if (!adminApplications.length) {
      const empty = document.createElement("p");
      empty.className = "access-empty";
      empty.textContent = "Aucune application dans le catalogue pour le moment.";
      adminAppList.append(empty);
      return;
    }

    for (const app of adminApplications) {
      const row = document.createElement("div");
      row.className = "access-row admin-app-row";
      const info = document.createElement("div");
      info.className = "access-row-info";
      const name = document.createElement("strong");
      name.textContent = app.name;
      const meta = document.createElement("span");
      meta.className = "admin-app-meta";
      const details = document.createElement("span");
      const maxDevices = app.max_devices || 1;
      const deviceInfo = devicesSupported && app.slug ? ` · ${maxDevices} appareil${maxDevices > 1 ? "s" : ""} max` : "";
      details.textContent = `${getPlatformLabel(app.platform)} · v${app.version}${app.slug ? ` · identifiant : ${app.slug}` : ""}${deviceInfo}`;
      const status = document.createElement("span");
      status.className = app.published ? "app-status published" : "app-status";
      status.textContent = app.published ? "Publiée" : "Non publiée";
      meta.append(details, status);
      info.append(name, meta);

      const actions = document.createElement("div");
      actions.className = "admin-app-actions";
      actions.append(createAdminButton(
        app.published ? "Dépublier" : "Publier",
        "button-quiet",
        () => togglePublished(app, row)
      ));
      if (app.platform === "android") {
        actions.append(createAdminButton("Nouvelle version APK", "button-quiet", () => chooseNewApk(app, row)));
      }
      if (slugSupported) {
        actions.append(createAdminButton("Identifiant", "button-quiet", () => editSlug(app, row)));
      }
      if (devicesSupported && app.slug) {
        actions.append(createAdminButton("Appareils max", "button-quiet", () => editMaxDevices(app, row)));
      }
      actions.append(createAdminButton("Supprimer", "access-revoke", () => deleteApplication(app, row)));
      row.append(info, actions);
      adminAppList.append(row);
    }
  }

  function normalizeSlug(value) {
    const slug = String(value || "").trim().toLowerCase();
    if (!slug) return null;
    if (!SLUG_PATTERN.test(slug)) {
      throw new Error("SLUG_INVALID");
    }
    return slug;
  }

  async function editSlug(app, row) {
    const answer = window.prompt(
      `Identifiant de connexion de « ${app.name} »
(celui prévu dans le code de l’application, ex. au-fil-du-mois).
Laissez vide pour le retirer.`,
      app.slug || ""
    );
    if (answer === null) return;
    let slug;
    try {
      slug = normalizeSlug(answer);
    } catch {
      setMessage(appsMessage, "Identifiant invalide : 2 à 40 caractères, lettres minuscules, chiffres et tirets.", false);
      return;
    }
    setRowBusy(row, true);
    try {
      const { data, error } = await supabaseClient
        .from("store_apps")
        .update({ slug })
        .eq("id", app.id)
        .select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("No application row updated");
    } catch (error) {
      console.error("Could not change slug:", error);
      setMessage(
        appsMessage,
        error && error.code === "23505" ? "Cet identifiant est déjà utilisé par une autre application." : "L’identifiant n’a pas pu être enregistré. Réessayez.",
        false
      );
      setRowBusy(row, false);
      return;
    }
    setMessage(appsMessage, slug ? `Identifiant de « ${app.name} » : ${slug}` : `Identifiant de « ${app.name} » retiré.`, true);
    await refreshAfterAdminChange();
  }

  async function togglePublished(app, row) {
    setRowBusy(row, true);
    try {
      const { data, error } = await supabaseClient
        .from("store_apps")
        .update({ published: !app.published })
        .eq("id", app.id)
        .select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("No application row updated");
    } catch (error) {
      console.error("Could not change publication status:", error);
      setMessage(appsMessage, "La publication n’a pas pu être modifiée. Réessayez.", false);
      setRowBusy(row, false);
      return;
    }
    setMessage(
      appsMessage,
      app.published ? `« ${app.name} » n’est plus visible des clients.` : `« ${app.name} » est maintenant publiée.`,
      true
    );
    await refreshAfterAdminChange();
  }

  async function deleteApplication(app, row) {
    const confirmed = window.confirm(
      `Supprimer définitivement « ${app.name} » ?\nLes accès des clients à cette application seront également supprimés.`
    );
    if (!confirmed) return;
    setRowBusy(row, true);
    try {
      const { data, error } = await supabaseClient
        .from("store_apps")
        .delete()
        .eq("id", app.id)
        .select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("No application row deleted");
    } catch (error) {
      console.error("Could not delete application:", error);
      setMessage(appsMessage, "L’application n’a pas pu être supprimée. Réessayez.", false);
      setRowBusy(row, false);
      return;
    }
    const fileRemoved = await removeApk(app.storage_path);
    setMessage(
      appsMessage,
      fileRemoved
        ? `« ${app.name} » a été supprimée.`
        : `« ${app.name} » a été supprimée, mais son fichier APK n’a pas pu être effacé du stockage.`,
      fileRemoved
    );
    await refreshAfterAdminChange();
  }

  function chooseNewApk(app, row) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".apk,application/vnd.android.package-archive";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (file) replaceApk(app, row, file);
    });
    input.click();
  }

  async function replaceApk(app, row, file) {
    const fileError = validateApk(file);
    if (fileError) {
      setMessage(appsMessage, fileError, false);
      return;
    }
    const versionInput = window.prompt(`Numéro de version du nouvel APK pour « ${app.name} » :`, app.version);
    if (versionInput === null) return;
    const version = versionInput.trim();
    if (!version || version.length > 20) {
      setMessage(appsMessage, "Indiquez un numéro de version de 1 à 20 caractères.", false);
      return;
    }

    setRowBusy(row, true);
    setMessage(appsMessage, `Envoi de la nouvelle version de « ${app.name} »…`, true);
    let newPath = null;
    try {
      newPath = await uploadApk(file);
      const { data, error } = await supabaseClient
        .from("store_apps")
        .update({ storage_path: newPath, version })
        .eq("id", app.id)
        .select("id");
      if (error) throw error;
      if (!data || !data.length) throw new Error("No application row updated");
    } catch (error) {
      console.error("APK replacement failed:", error);
      if (newPath) await removeApk(newPath);
      setMessage(appsMessage, "La nouvelle version n’a pas pu être enregistrée. L’ancienne version reste disponible.", false);
      setRowBusy(row, false);
      return;
    }
    const oldRemoved = await removeApk(app.storage_path);
    setMessage(
      appsMessage,
      oldRemoved
        ? `Nouvelle version de « ${app.name} » en ligne.`
        : `Nouvelle version de « ${app.name} » en ligne, mais l’ancien fichier n’a pas pu être effacé du stockage.`,
      oldRemoved
    );
    await refreshAfterAdminChange();
  }

  // ---------- Administration : accès des clients ----------

  async function loadAccessManager() {
    const selectedApp = accessAppSelect.value;
    accessAppSelect.replaceChildren(new Option("Choisir une application…", ""));
    for (const app of adminApplications) {
      const suffix = app.published ? "" : " (non publiée)";
      accessAppSelect.add(new Option(`${app.name} — v${app.version}${suffix}`, app.id));
    }
    if (adminApplications.some((app) => app.id === selectedApp)) accessAppSelect.value = selectedApp;

    const { data, error } = await supabaseClient
      .from("store_app_access")
      .select("id, email, app_id, store_apps(name)")
      .order("email", { ascending: true });
    if (error) throw error;
    clientAccessEntries = data || [];
    accessUserOptions.replaceChildren();
    for (const email of [...new Set(clientAccessEntries.map((entry) => entry.email))]) {
      accessUserOptions.append(new Option(email, email));
    }
    renderClientAccess();
  }

  function renderClientAccess() {
    const selectedEmail = accessUserFilter.value.trim().toLowerCase();
    const entries = selectedEmail
      ? clientAccessEntries.filter((entry) => entry.email.toLowerCase() === selectedEmail)
      : [];
    accessList.replaceChildren();
    accessListHeading.hidden = !selectedEmail;
    accessListHeading.textContent = selectedEmail ? `Applications accessibles à ${selectedEmail}` : "";
    if (!selectedEmail) {
      const empty = document.createElement("p");
      empty.className = "access-empty";
      empty.textContent = "Saisissez ou choisissez l’adresse e-mail d’un client pour voir ses applications.";
      accessList.append(empty);
      return;
    }
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "access-empty";
      empty.textContent = "Aucune application n’est attribuée à ce client pour le moment.";
      accessList.append(empty);
      return;
    }

    for (const access of entries) {
      const row = document.createElement("div");
      row.className = "access-row";
      const info = document.createElement("div");
      info.className = "access-row-info";
      const email = document.createElement("strong");
      email.textContent = access.email;
      const appName = document.createElement("span");
      appName.textContent = access.store_apps?.name || "Application indisponible";
      info.append(email, appName);
      const revoke = document.createElement("button");
      revoke.type = "button";
      revoke.className = "button access-revoke";
      revoke.textContent = "Retirer l’accès";
      revoke.addEventListener("click", () => revokeAccess(access.id, revoke));
      row.append(info, revoke);
      accessList.append(row);
    }
  }

  async function revokeAccess(accessId, button) {
    button.disabled = true;
    const { error } = await supabaseClient.from("store_app_access").delete().eq("id", accessId);
    if (error) {
      console.error("Could not revoke app access:", error);
      showToast("Impossible de retirer l’accès. Réessayez.");
      button.disabled = false;
      return;
    }
    try {
      await Promise.all([loadAccessManager(), loadCatalog()]);
      setMessage(accessMessage, "Accès retiré.", true);
    } catch (error) {
      console.error("Could not refresh app access:", error);
      showToast("L’accès a été retiré, mais la liste n’a pas pu être actualisée.");
    }
  }

  async function downloadApplication(app, button) {
    if (app.platform === "ios") {
      const link = document.createElement("a");
      link.href = app.install_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      return;
    }

    button.disabled = true;
    button.textContent = "Préparation…";
    try {
      const { data, error } = await supabaseClient
        .from("store_apps")
        .select("storage_path")
        .eq("id", app.id)
        .single();
      if (error) throw error;
      const { data: signed, error: signedError } = await supabaseClient
        .storage.from(APK_BUCKET)
        .createSignedUrl(data.storage_path, 60, { download: true });
      if (signedError) throw signedError;
      const link = document.createElement("a");
      link.href = signed.signedUrl;
      link.download = "";
      document.body.append(link);
      link.click();
      link.remove();
      showToast("Téléchargement lancé. Ouvrez le fichier sur votre appareil Android pour l’installer.");
    } catch (error) {
      console.error("APK download failed:", error);
      showToast("Impossible de préparer le téléchargement. Réessayez ou contactez-nous.");
    } finally {
      button.disabled = false;
      button.textContent = "Télécharger";
    }
  }

  // ---------- Formulaires ----------

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseClient) return;
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    setMessage(loginMessage, "Connexion en cours…", true);
    const formData = new FormData(loginForm);
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: formData.get("email"),
      password: formData.get("password")
    });
    button.disabled = false;
    if (error) {
      setMessage(loginMessage, "Connexion impossible. Vérifiez vos identifiants ou demandez une invitation.", false);
      return;
    }
    if (!data.session) {
      setMessage(loginMessage, "La connexion n’a pas créé de session. Réessayez.", false);
      return;
    }
    loginForm.reset();
    setMessage(loginMessage, "", false);
  });

  forgotPasswordButton.addEventListener("click", async () => {
    if (!supabaseClient) return;
    const emailInput = document.querySelector("#email");
    const email = emailInput.value.trim().toLowerCase();
    if (!email || !emailInput.checkValidity()) {
      setMessage(loginMessage, "Saisissez votre adresse e-mail ci-dessus, puis cliquez sur « Mot de passe oublié ? ».", false);
      emailInput.focus();
      return;
    }
    forgotPasswordButton.disabled = true;
    setMessage(loginMessage, "Envoi en cours…", true);
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${getPageUrl()}?recovery=1`
    });
    forgotPasswordButton.disabled = false;
    if (error) {
      console.error("Password reset request failed:", error);
      if (error.status === 429) {
        setMessage(loginMessage, "Trop de demandes récentes. Patientez quelques minutes avant de réessayer.", false);
        return;
      }
    }
    // Message identique que le compte existe ou non.
    setMessage(
      loginMessage,
      "Si un compte existe pour cette adresse, vous allez recevoir un e-mail pour choisir un nouveau mot de passe.",
      true
    );
  });

  loginOpen.addEventListener("click", showLogin);
  document.querySelector("#login-close").addEventListener("click", showHome);
  document.querySelectorAll(".home-login-button, .discovery-note .text-button").forEach((button) => {
    button.addEventListener("click", showLogin);
  });
  publicSearch.addEventListener("input", renderPublicCatalog);

  document.querySelector("#sign-out").addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error("Sign out failed:", error);
      showToast("La déconnexion n’a pas abouti. Réessayez.");
      return;
    }
    showSignedOut();
  });

  inviteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = inviteForm.querySelector("button[type=submit]");
    const email = String(new FormData(inviteForm).get("email") || "").trim().toLowerCase();
    button.disabled = true;
    setMessage(inviteMessage, "Envoi de l’invitation…", true);
    try {
      const { error } = await supabaseClient.functions.invoke("invite-client", { body: { email } });
      if (error) throw error;
      inviteForm.reset();
      setMessage(inviteMessage, "Invitation envoyée. Le client pourra définir son mot de passe depuis l’e-mail reçu.", true);
    } catch (error) {
      console.error("Could not invite client:", error);
      const message = await getFunctionErrorMessage(
        error,
        "L’invitation n’a pas pu être envoyée. Vérifiez le déploiement de la fonction et la configuration e-mail Supabase."
      );
      setMessage(inviteMessage, message, false);
    } finally {
      button.disabled = false;
    }
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = passwordForm.querySelector("button[type=submit]");
    const password = String(new FormData(passwordForm).get("password") || "");
    if (password.length < 8) {
      setMessage(passwordMessage, "Choisissez un mot de passe d’au moins 8 caractères.", false);
      return;
    }
    button.disabled = true;
    setMessage(passwordMessage, "Enregistrement…", true);
    const { error } = await supabaseClient.auth.updateUser({ password });
    button.disabled = false;
    if (error) {
      console.error("Could not set user password:", error);
      setMessage(passwordMessage, "Le mot de passe n’a pas pu être enregistré. Le lien est peut-être expiré.", false);
      return;
    }
    passwordForm.reset();
    setMessage(passwordMessage, "", false);
    window.history.replaceState({}, "", window.location.pathname);
    showToast("Mot de passe enregistré. Bienvenue !");
    // Seul chargement après l’enregistrement : l’événement USER_UPDATED est ignoré.
    try {
      await showSignedIn((await supabaseClient.auth.getSession()).data.session);
    } catch (loadError) {
      console.error("Store loading failed:", loadError);
      showSignedOut("Votre mot de passe est enregistré, mais votre espace n’a pas pu être chargé.");
    }
  });

  searchInput.addEventListener("input", renderCatalog);
  accessUserFilter.addEventListener("input", renderClientAccess);

  platformSelect.addEventListener("change", () => {
    const isIos = platformSelect.value === "ios";
    apkField.hidden = isIos;
    apkInput.required = !isIos;
    iosLinkField.hidden = !isIos;
    iosLinkInput.required = isIos;
  });

  accessForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = accessForm.querySelector("button[type=submit]");
    const formData = new FormData(accessForm);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const appId = String(formData.get("app_id") || "");
    if (!email || !appId) {
      setMessage(accessMessage, "Indiquez un e-mail et choisissez une application.", false);
      return;
    }
    button.disabled = true;
    setMessage(accessMessage, "Enregistrement de l’accès…", true);
    const { error } = await supabaseClient.from("store_app_access").insert({ email, app_id: appId });
    button.disabled = false;
    if (error) {
      console.error("Could not grant app access:", error);
      setMessage(
        accessMessage,
        error.code === "23505" ? "Cet accès existe déjà." : "Impossible d’ajouter cet accès. Vérifiez l’adresse et réessayez.",
        false
      );
      return;
    }
    accessForm.reset();
    accessUserFilter.value = email;
    try {
      await Promise.all([loadAccessManager(), loadCatalog()]);
      setMessage(accessMessage, "Accès accordé. Le client verra l’application à sa prochaine connexion.", true);
    } catch (refreshError) {
      console.error("Could not refresh app access:", refreshError);
      setMessage(accessMessage, "Accès accordé, mais la liste n’a pas pu être actualisée.", false);
    }
  });

  appForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const formData = new FormData(form);
    const platform = String(formData.get("platform"));
    const file = formData.get("file");
    let installUrl = null;
    let slug = null;
    try {
      slug = normalizeSlug(formData.get("slug"));
    } catch {
      setMessage(adminMessage, "Identifiant invalide : 2 à 40 caractères, lettres minuscules, chiffres et tirets.", false);
      return;
    }
    if (slug && !slugSupported) {
      setMessage(adminMessage, "Exécutez d’abord la migration 002 dans Supabase pour utiliser les identifiants de connexion.", false);
      return;
    }
    if (platform === "android") {
      const fileError = validateApk(file);
      if (fileError) {
        setMessage(adminMessage, fileError, false);
        return;
      }
    } else {
      try {
        const url = new URL(String(formData.get("install_url") || ""));
        if (url.protocol !== "https:" || !["apps.apple.com", "testflight.apple.com"].includes(url.hostname)) {
          throw new Error("Un lien App Store ou TestFlight HTTPS est requis.");
        }
        installUrl = url.href;
      } catch {
        setMessage(adminMessage, "Ajoutez un lien HTTPS valide provenant de l’App Store ou de TestFlight.", false);
        return;
      }
    }

    button.disabled = true;
    setMessage(adminMessage, "Envoi de l’application…", true);
    let storagePath = null;
    try {
      if (platform === "android") storagePath = await uploadApk(file);

      const newApp = {
        name: formData.get("name").trim(),
        description: formData.get("description").trim(),
        version: formData.get("version").trim(),
        platform,
        install_url: installUrl,
        storage_path: storagePath,
        published: true
      };
      if (slug) newApp.slug = slug;
      const { error: insertError } = await supabaseClient.from("store_apps").insert(newApp);
      if (insertError) {
        if (storagePath) await removeApk(storagePath);
        throw insertError;
      }

      form.reset();
      platformSelect.dispatchEvent(new Event("change"));
      setMessage(adminMessage, "Application ajoutée au catalogue.", true);
    } catch (error) {
      console.error("App publishing failed:", error);
      setMessage(
        adminMessage,
        error && error.code === "23505" && slug
          ? "Cet identifiant de connexion est déjà utilisé par une autre application."
          : "L’ajout a échoué. Vérifiez le fichier et les autorisations, puis réessayez.",
        false
      );
      return;
    } finally {
      button.disabled = false;
    }
    // Actualise le catalogue, la liste d’administration et le menu des accès.
    await refreshAfterAdminChange();
  });

  // ---------- Démarrage ----------

  pendingAuthMessage = consumeAuthRedirectError();

  function handleAuthChange(event, session) {
    const message = pendingAuthMessage;
    pendingAuthMessage = "";
    if (!session) {
      showSignedOut(message);
      return;
    }
    if (message) showToast(message);
    // SIGNED_IN peut être réémis (retour sur l’onglet) : pas de rechargement inutile.
    if (event === "SIGNED_IN" && session.user.id === currentUserId) return;
    showSignedIn(session, { forcePassword: event === "PASSWORD_RECOVERY" }).catch((error) => {
      console.error("Session initialization failed:", error);
      showSignedOut("Impossible de charger votre espace. Réessayez plus tard.");
    });
  }

  if (configureSupabase()) {
    loadPublicCatalog().catch((error) => {
      console.error("Could not load public app catalog:", error);
      publicEmpty.hidden = false;
      publicEmptyText.textContent = "Impossible de charger le catalogue. Réessayez un peu plus tard.";
    });
    const handledEvents = new Set(["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "PASSWORD_RECOVERY"]);
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (!handledEvents.has(event)) return;
      setTimeout(() => handleAuthChange(event, session), 0);
    });
  }
})();
