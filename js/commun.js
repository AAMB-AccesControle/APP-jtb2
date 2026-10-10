
// ============================================
// AAMB - Code commun partagé entre toutes les pages
// ============================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxuj0RBchwQbOWJHpVxjlM29B0jRdxr8S2HFgRlWc1UpJ3-EXskuXkXDAdcXskyLuWGA/exec';
const MESSAGERIE_CACHE_KEY = 'aamb_messagerie_cache';
const MESSAGERIE_SYNC_INTERVAL = 30000; // 30 secondes

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

function estOrganisateur() {
    const a = chargerAdherent();
    return a && a.statut === 'Organisateur';
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
    document.querySelectorAll('.toggle-label').forEach(lbl => lbl.textContent = isDark ? '' : '☀️');
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

// ===== HEADER PRINCIPAL (injecté dans toutes les sous-pages) =====
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
        <div class="header-bottom">
            <div class="header-version">v42.0</div>
        </div>
    `;

    document.body.insertBefore(header, document.body.firstChild);
}

// ===== NAVIGATION RETOUR =====
function retourAccueil() {
    window.location.href = getRacine() + 'app.html';
}

// ===== HORS LIGNE =====
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

// ===== ERREURS GLOBALES =====
window.addEventListener('error', (e) => { console.error('Erreur globale:', e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { console.error('Promesse rejetée:', e.reason); });

// ============================================
// SYNCHRONISATION MESSAGERIE EN ARRIÈRE-PLAN
// ============================================
let messagerieSyncTimer = null;
let messagerieSyncEnCours = false;
let messagerieFormulaireOuvert = false;

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
        localStorage.setItem(MESSAGERIE_CACHE_KEY, JSON.stringify({
            userId: adherent.id,
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) { console.warn('Cache messagerie sauvegarde échouée:', e); }
}

async function syncMessagerieBackground() {
    if (messagerieSyncEnCours) return;
    const adherent = chargerAdherent();
    if (!adherent) return;
    
    messagerieSyncEnCours = true;
    try {
        const action = adherent.statut === 'Organisateur' ? 'getAllMessages' : 'getMyMessages';
        const resp = await fetch(SCRIPT_URL + '?action=' + action + '&userId=' + encodeURIComponent(adherent.id), { cache: 'no-store' });
        const data = await resp.json();
        
        if (data.success) {
            saveMessagerieCache(data);
            if (!messagerieFormulaireOuvert) {
                window.dispatchEvent(new CustomEvent('messagerie-updated', { detail: data }));
            }
        }
    } catch (e) { /* silencieux */ }
    finally { messagerieSyncEnCours = false; }
}

function startMessagerieBackgroundSync() {
    const adherent = chargerAdherent();
    if (!adherent) return;
    syncMessagerieBackground();
    if (messagerieSyncTimer) clearInterval(messagerieSyncTimer);
    messagerieSyncTimer = setInterval(() => {
        if (!document.hidden) syncMessagerieBackground();
    }, MESSAGERIE_SYNC_INTERVAL);
}

function stopMessagerieBackgroundSync() {
    if (messagerieSyncTimer) { clearInterval(messagerieSyncTimer); messagerieSyncTimer = null; }
}


// ===== CHARGEMENT LISTE ADHÉRENTS (pour organisateurs) =====
const ADHERENTS_CACHE_KEY = 'aamb_adherents_cache';
const ADHERENTS_CACHE_DURATION = 3600000; // 1 heure

function getAdherentsFromCache() {
    try {
        const raw = localStorage.getItem(ADHERENTS_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        if (Date.now() - cache.timestamp > ADHERENTS_CACHE_DURATION) return null;
        return cache.data;
    } catch (e) { return null; }
}

function saveAdherentsToCache(data) {
    try {
        localStorage.setItem(ADHERENTS_CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) { console.warn('Cache adhérents échoué:', e); }
}

async function chargerListeAdherentsSilencieux() {
    const adherent = chargerAdherent();
    if (!adherent || adherent.statut !== 'Organisateur') return;
    
    // Si déjà en cache et frais, ne pas recharger
    if (getAdherentsFromCache()) return;
    
    try {
        const resp = await fetch(SCRIPT_URL + '?action=getAdherents&userId=' + encodeURIComponent(adherent.id));
        const data = await resp.json();
        if (data.success) {
            saveAdherentsToCache({ adherents: data.adherents, statuts: data.statuts });
        }
    } catch (e) { console.warn('Chargement adhérents échoué:', e); }
}

// ===== INITIALISATION AUTOMATIQUE =====
document.addEventListener('DOMContentLoaded', function() {
    appliquerDarkModeInitial();
    initOfflineDetection();
    
    // Charger le CSS du header
    chargerCSSHeader();
    
    // Injecter le header principal dans toutes les pages SAUF app.html et index.html
    const chemin = window.location.pathname;
    if (!chemin.endsWith('app.html') && !chemin.endsWith('index.html')) {
        injecterHeaderPrincipal();
    }
    
    // Démarrer la synchro messagerie en arrière-plan
    const adherent = chargerAdherent();
    if (adherent) startMessagerieBackgroundSync();
});

window.addEventListener('beforeunload', () => { stopMessagerieBackgroundSync(); });
