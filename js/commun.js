// ============================================
// AAMB - Code commun partagé entre toutes les pages
// ============================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyoFYvSYxuVhIaM_AIcozqLhdbySkpXzcyKWfl_rglH9F-iiCZ3QIhVQZ7pWbTq28PYtA/exec';

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
    const sw = document.getElementById('toggleSwitch');
    const lbl = document.getElementById('toggleLabel');
    if (sw) sw.classList.toggle('on', isDark);
    if (lbl) lbl.textContent = isDark ? '🌙' : '☀️';
    localStorage.setItem('darkMode', isDark ? '1' : '0');
}

function appliquerDarkModeInitial() {
    if (localStorage.getItem('darkMode') === '1') {
        document.body.classList.add('dark');
        const sw = document.getElementById('toggleSwitch');
        const lbl = document.getElementById('toggleLabel');
        if (sw) sw.classList.add('on');
        if (lbl) lbl.textContent = '🌙';
    }
}

// ===== EN-TÊTE STANDARD =====
function afficherInfosUtilisateur() {
    const adherent = chargerAdherent();
    const el = document.getElementById('headerUser');
    if (el && adherent) {
        el.textContent = '👤 ' + adherent.prenom + ' ' + adherent.nom + ' — ' + adherent.statut;
    }
}

// ===== NAVIGATION RETOUR =====
function retourAccueil() {
    window.location.href = getRacine() + 'app.html';
}

// ===== GESTION HORS LIGNE =====
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

// ===== GESTION D'ERREUR GLOBALE =====
window.addEventListener('error', (e) => { console.error('Erreur globale:', e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => { console.error('Promesse rejetée:', e.reason); });

// ============================================
// SYNCHRONISATION MESSAGERIE EN ARRIÈRE-PLAN
// Tourne sur TOUTES les pages pour garder le cache à jour
// ============================================
const MESSAGERIE_CACHE_KEY = 'aamb_messagerie_cache';
const MESSAGERIE_SYNC_INTERVAL = 45000; // 45 secondes
let messagerieSyncTimer = null;
let messagerieSyncEnCours = false;

async function syncMessagerieBackground() {
    if (messagerieSyncEnCours) return;
    const adherent = chargerAdherent();
    if (!adherent) return;
    
    messagerieSyncEnCours = true;
    try {
        const action = adherent.statut === 'Organisateur' ? 'getAllMessages' : 'getMyMessages';
        const resp = await fetch(SCRIPT_URL + '?action=' + action + '&userId=' + encodeURIComponent(adherent.id), {
            cache: 'no-store'
        });
        const data = await resp.json();
        
        if (data.success) {
            const ancienCache = JSON.parse(localStorage.getItem(MESSAGERIE_CACHE_KEY) || 'null');
            // Comparaison rapide pour éviter les écritures inutiles
            const anciensIds = Object.keys(ancienCache?.data?.conversations || {}).sort().join(',');
            const nouveauxIds = Object.keys(data.conversations || {}).sort().join(',');
            const aChanged = anciensIds !== nouveauxIds;
            
            // Vérifier aussi si le dernier message de chaque conv a changé
            let msgChanged = false;
            if (!aChanged && ancienCache?.data?.conversations) {
                for (const key in data.conversations) {
                    const oldLast = ancienCache.data.conversations[key]?.slice(-1)[0];
                    const newLast = data.conversations[key]?.slice(-1)[0];
                    if (oldLast?.idConvFull !== newLast?.idConvFull) {
                        msgChanged = true;
                        break;
                    }
                }
            }
            
            if (aChanged || msgChanged || !ancienCache) {
                localStorage.setItem(MESSAGERIE_CACHE_KEY, JSON.stringify({
                    userId: adherent.id,
                    timestamp: Date.now(),
                    data: data
                }));
                // Dispatch un événement pour que messagerie.html se mette à jour si ouvert
                window.dispatchEvent(new CustomEvent('messagerie-updated', { detail: data }));
            }
        }
    } catch (e) {
        // Silencieux
    } finally {
        messagerieSyncEnCours = false;
    }
}

function startMessagerieBackgroundSync() {
    const adherent = chargerAdherent();
    if (!adherent) return;
    
    // Synchro immédiate
    syncMessagerieBackground();
    
    // Puis régulièrement
    if (messagerieSyncTimer) clearInterval(messagerieSyncTimer);
    messagerieSyncTimer = setInterval(() => {
        // Ne synchro que si la page est visible (économie batterie)
        if (!document.hidden) {
            syncMessagerieBackground();
        }
    }, MESSAGERIE_SYNC_INTERVAL);
}

function stopMessagerieBackgroundSync() {
    if (messagerieSyncTimer) {
        clearInterval(messagerieSyncTimer);
        messagerieSyncTimer = null;
    }
}

// Pause quand la page est en arrière-plan
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // On laisse le timer tourner mais il ne fera rien si document.hidden
        // (géré dans le setInterval ci-dessus)
    }
});

// ============================================
// INITIALISATION AUTOMATIQUE
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    appliquerDarkModeInitial();
    afficherInfosUtilisateur();
    initOfflineDetection();
    
    // Démarrer la synchro messagerie en arrière-plan si connecté
    const adherent = chargerAdherent();
    if (adherent) {
        startMessagerieBackgroundSync();
    }
});

// Arrêter proprement à la fermeture
window.addEventListener('beforeunload', () => {
    stopMessagerieBackgroundSync();
});
