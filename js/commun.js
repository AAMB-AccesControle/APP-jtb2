// ============================================
// AAMB - Code commun partagé entre toutes les pages
// ============================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyoFYvSYxuVhIaM_AIcozqLhdbySkpXzcyKWfl_rglH9F-iiCZ3QIhVQZ7pWbTq28PYtA/exec';
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
        document.cookie = 'aamb_adherent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
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
        document.querySelectorAll('.toggle-label').forEach(lbl => lbl.textContent = '');
    }
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
            // Notifie les pages ouvertes
            window.dispatchEvent(new CustomEvent('messagerie-updated', { detail: data }));
        }
    } catch (e) { /* silencieux */ }
    finally { messagerieSyncEnCours = false; }
}

function startMessagerieBackgroundSync() {
    const adherent = chargerAdherent();
    if (!adherent) return;
    // Synchro immédiate
    syncMessagerieBackground();
    // Puis toutes les 30s (uniquement si page visible)
    if (messagerieSyncTimer) clearInterval(messagerieSyncTimer);
    messagerieSyncTimer = setInterval(() => {
        if (!document.hidden) syncMessagerieBackground();
    }, MESSAGERIE_SYNC_INTERVAL);
}

function stopMessagerieBackgroundSync() {
    if (messagerieSyncTimer) { clearInterval(messagerieSyncTimer); messagerieSyncTimer = null; }
}

// ===== INITIALISATION AUTOMATIQUE =====
document.addEventListener('DOMContentLoaded', function() {
    appliquerDarkModeInitial();
    initOfflineDetection();
    
    const adherent = chargerAdherent();
    if (adherent) startMessagerieBackgroundSync();
});

window.addEventListener('beforeunload', () => { stopMessagerieBackgroundSync(); });
