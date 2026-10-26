// ============================================
// AAMB - Code commun partagé entre toutes les pages
// ============================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwVUxuSDbZSA1_vueL9lm5dtwxWPyD31WSmHK10S6QYv4CaQMWX_0QgK0aaL3zodIcu-w/exec';
const MESSAGERIE_CACHE_KEY = 'aamb_messagerie_cache';
const ADHERENTS_CACHE_KEY = 'aamb_adherents_cache';
const PROGRAMME_CACHE_KEY = 'aamb_programme_cache';
const PROGRAMME_CACHE_DURATION = 900000; // 15 minutes

let messagerieFormulaireOuvert = false;
let messagerieSyncTimer = null;
let messagerieSyncEnCours = false;
let programmeSyncTimer = null;

// ===== GESTION ADHÉRENT =====
function chargerAdherent() {
    try {
        const ls = localStorage.getItem('aamb_adherent');
        if (ls) return JSON.parse(ls);
        const c = document.cookie.split(';').find(c => c.trim().startsWith('aamb_adherent='));
        if (c) return JSON.parse(decodeURIComponent(c.split('=')[1]));
    } catch (e) { console.error('Erreur chargement adhérent:', e); }
    return null;
}

function sauvegarderAdherent(a) {
    try {
        localStorage.setItem('aamb_adherent', JSON.stringify(a));
        const exp = new Date(Date.now() + 30*24*60*60*1000).toUTCString();
        document.cookie = 'aamb_adherent=' + encodeURIComponent(JSON.stringify(a)) + '; expires=' + exp + '; path=/; SameSite=Lax';
    } catch (e) { console.error('Erreur sauvegarde adhérent:', e); }
}

function deconnecter() {
    if (!confirm('Voulez-vous vraiment vous déconnecter ?')) return;
    try {
        localStorage.removeItem('aamb_adherent');
        document.cookie = 'aamb_adherent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
    } catch (e) {}
    window.location.href = getRacine() + 'index.html';
}

function verifierConnexionOuRediriger() {
    const adherent = chargerAdherent();
    if (!adherent) {
        window.location.href = getRacine() + 'app.html';
        return null;
    }
    return adherent;
}

function getRacine() {
    return window.location.pathname.includes('/pages/') ? '../' : './';
}

// ===== DARK MODE =====
function toggleDark() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    document.querySelectorAll('.toggle-switch').forEach(sw => sw.classList.toggle('on', isDark));
    document.querySelectorAll('.toggle-label').forEach(lbl => lbl.textContent = isDark ? '🌙' : '☀️');
    localStorage.setItem('darkMode', isDark ? '1' : '0');
}

function appliquerDarkModeInitial() {
    if (localStorage.getItem('darkMode') === '1') {
        document.body.classList.add('dark');
        document.querySelectorAll('.toggle-switch').forEach(sw => sw.classList.add('on'));
        document.querySelectorAll('.toggle-label').forEach(lbl => lbl.textContent = '🌙');
    }
}

// ===== CHARGEMENT CSS HEADER =====
function chargerCSSHeader() {
    if (document.getElementById('aamb-header-css')) return;
    const link = document.createElement('link');
    link.id = 'aamb-header-css';
    link.rel = 'stylesheet';
    link.href = getRacine() + 'css/header.css';
    document.head.appendChild(link);
}

// ===== HEADER PRINCIPAL =====
function injecterHeaderPrincipal() {
    const adherent = chargerAdherent();
    if (!adherent) return;
    const header = document.createElement('header');
    header.id = 'header-principal';
    header.innerHTML = `
        <div class="header-top">
            <div class="header-left">
                <div class="header-logo"><img src="${getRacine()}logo-aamb.png" alt="AAMB"></div>
                <div class="header-user-info">
                    <div class="header-user-name">${adherent.prenom} ${adherent.nom}</div>
                    <div class="header-user-statut">${adherent.statut}</div>
                </div>
            </div>
            <div class="header-right">
                <div class="dark-toggle" onclick="toggleDark()" role="button" aria-label="Mode sombre">
                    <span class="toggle-label">☀️</span>
                    <div class="toggle-switch"><div class="toggle-knob"></div></div>
                </div>
                <div class="deconnexion" onclick="deconnecter()" role="button" aria-label="Se déconnecter">
                    <div class="icon">🚪</div>
                    <div class="label">Quitter</div>
                </div>
            </div>
        </div>
        <div class="header-bottom"><div class="header-version">v42.0</div></div>
    `;
    document.body.insertBefore(header, document.body.firstChild);
}

function retourAccueil() { window.location.href = getRacine() + 'app.html'; }

function initOfflineDetection() {
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ef4444;color:white;text-align:center;padding:8px;font-size:13px;font-weight:bold;z-index:99999;display:none;';
    banner.textContent = '⚠️ Vous êtes hors ligne';
    document.body.appendChild(banner);
    window.addEventListener('offline', () => { banner.style.display = 'block'; });
    window.addEventListener('online', () => { banner.style.display = 'none'; });
    if (!navigator.onLine) banner.style.display = 'block';
}

window.addEventListener('error', (e) => { console.error('Erreur globale:', e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { console.error('Promesse rejetée:', e.reason); });

// ============================================
// CACHES & SYNCHRONISATION
// ============================================
function getMessagerieCache() {
    try {
        const raw = localStorage.getItem(MESSAGERIE_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        const adherent = chargerAdherent();
        if (!adherent || cache.userId !== adherent.id) return null;
        return cache;
    } catch (e) { return null; }
}

function saveMessagerieCache(data) {
    try {
        const adherent = chargerAdherent();
        if (!adherent) return;
        localStorage.setItem(MESSAGERIE_CACHE_KEY, JSON.stringify({ userId: adherent.id, timestamp: Date.now(), data: data }));
    } catch (e) { console.warn('Cache messagerie échoué:', e); }
}

function getAdherentsFromCache() {
    try {
        const raw = localStorage.getItem(ADHERENTS_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        if (Date.now() - cache.timestamp > 3600000) return null; // 1h
        return cache.data;
    } catch (e) { return null; }
}

function saveAdherentsToCache(data) {
    try { localStorage.setItem(ADHERENTS_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: data })); } 
    catch (e) { console.warn('Cache adhérents échoué:', e); }
}

function getProgrammeFromCache() {
    try {
        const raw = localStorage.getItem(PROGRAMME_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        if (Date.now() - cache.timestamp > PROGRAMME_CACHE_DURATION) return null;
        return cache.data;
    } catch (e) { return null; }
}

function saveProgrammeToCache(data) {
    try { localStorage.setItem(PROGRAMME_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: data })); } 
    catch (e) { console.warn('Cache programme échoué:', e); }
}

// ==========================================
// MOTEUR DE PRÉCHARGEMENT INTELLIGENT
// ==========================================
(function() {
    async function updateAllCaches() {
        if (document.hidden) return; // Ne pas exécuter si l'onglet est caché (économie batterie)
        
        const adherent = chargerAdherent();
        if (!adherent || typeof SCRIPT_URL === 'undefined') return;
        const userId = adherent.id;

        try {
            // 1. Messages
            const actionMsg = adherent.statut === 'Organisateur' ? 'getAllMessages' : 'getMyMessages';
            const respMsg = await fetch(SCRIPT_URL + '?action=' + actionMsg + '&userId=' + encodeURIComponent(userId));
            const dataMsg = await respMsg.json();
            if (dataMsg.success) saveMessagerieCache(dataMsg);

            // 2. Adhérents (si organisateur)
            if (adherent.statut === 'Organisateur') {
                const respAdh = await fetch(SCRIPT_URL + '?action=getAdherents&userId=' + encodeURIComponent(userId));
                const dataAdh = await respAdh.json();
                if (dataAdh.success) saveAdherentsToCache({ adherents: dataAdh.adherents, statuts: dataAdh.statuts });
            }

            // 3. Vote AG
            const respVote = await fetch(SCRIPT_URL + '?action=getVoteAGData&userId=' + encodeURIComponent(userId));
            const dataVote = await respVote.json();
            if (dataVote.success) localStorage.setItem('aamb_voteag_cache', JSON.stringify({ timestamp: Date.now(), data: dataVote }));

            // 4. Chat AG
            const respChat = await fetch(SCRIPT_URL + '?action=getChatAG&userId=' + encodeURIComponent(userId));
            const dataChat = await respChat.json();
            if (dataChat.success) localStorage.setItem('aamb_chatag_cache', JSON.stringify({ timestamp: Date.now(), data: dataChat }));

            // 5. Chat Conférences
            const respConf = await fetch(SCRIPT_URL + '?action=getChatConferences');
            const dataConf = await respConf.json();
            if (dataConf.success) localStorage.setItem('aamb_chatconf_cache', JSON.stringify({ timestamp: Date.now(), data: dataConf }));

        } catch (e) {
            console.warn('[Background] Erreur mise à jour caches:', e);
        }
    }

    // Lancer immédiatement au chargement
    const adherent = chargerAdherent();
    if (adherent) {
        updateAllCaches();
        // Et répéter toutes les 30s seulement si l'onglet est actif
        setInterval(() => { if (!document.hidden) updateAllCaches(); }, 30000);
    }

    // ✅ FORCER la mise à jour dès que l'utilisateur revient sur l'onglet
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && adherent) {
            console.log('[Background] Onglet visible, mise à jour des caches...');
            updateAllCaches();
        }
    });
})();
