// ============================================
// AAMB - Code commun partagé entre toutes les pages
// ============================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxPaLIE0rlYV9VPLboL1ysI38E1GY6D8I6-eZJnZBr_UNhUt86i3Zv64WuondDbyt2ymw/exec';
const MESSAGERIE_CACHE_KEY = 'aamb_messagerie_cache';
const MESSAGERIE_SYNC_INTERVAL = 30000; // 30 secondes
const ADHERENTS_CACHE_KEY = 'aamb_adherents_cache';
const ADHERENTS_CACHE_DURATION = 3600000; // 1 heure
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
                    <span class="toggle-label">️</span>
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
    if (!adherent) {
        console.log('[Messagerie] Pas d\'adhérent connecté, synchro annulée');
        return;
    }
    
    messagerieSyncEnCours = true;
    console.log('[Messagerie] Début synchro pour', adherent.id, '-', adherent.statut);
    
    try {
        const action = adherent.statut === 'Organisateur' ? 'getAllMessages' : 'getMyMessages';
        const url = SCRIPT_URL + '?action=' + action + '&userId=' + encodeURIComponent(adherent.id);
        console.log('[Messagerie] Fetch:', url);
        
        const resp = await fetch(url, { cache: 'no-store' });
        const data = await resp.json();
        console.log('[Messagerie] Réponse reçue:', data.success ? 'OK' : 'Erreur');
        
        if (data.success) {
            saveMessagerieCache(data);
            console.log('[Messagerie] Cache sauvegardé avec', Object.keys(data.conversations || {}).length, 'conversations');
            
            if (typeof window.onMessagerieSynced === 'function') {
                window.onMessagerieSynced(data);
            }
            
            if (!messagerieFormulaireOuvert) {
                window.dispatchEvent(new CustomEvent('messagerie-updated', { detail: data }));
            }
        } else {
            console.warn('[Messagerie] Erreur API:', data.message);
        }
    } catch (e) {
        console.error('[Messagerie] Erreur synchro:', e);
    }
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

// ============================================
// CHARGEMENT LISTE ADHÉRENTS (pour organisateurs)
// ============================================
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
    
    if (getAdherentsFromCache()) return;
    
    try {
        const resp = await fetch(SCRIPT_URL + '?action=getAdherents&userId=' + encodeURIComponent(adherent.id));
        const data = await resp.json();
        if (data.success) {
            saveAdherentsToCache({ adherents: data.adherents, statuts: data.statuts });
        }
    } catch (e) { console.warn('Chargement adhérents échoué:', e); }
}

// ============================================
// CHARGEMENT PROGRAMME EN ARRIÈRE-PLAN
// ============================================
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
    try {
        localStorage.setItem(PROGRAMME_CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) { console.warn('Cache programme échoué:', e); }
}

async function chargerProgrammeBackground() {
    try {
        const resp = await fetch(SCRIPT_URL + '?action=getProgramme');
        const data = await resp.json();
        if (data.success) {
            saveProgrammeToCache(data.programme);
            console.log('[Programme] Cache mis à jour -', data.programme.length, 'entrées');
        }
    } catch (e) { console.warn('[Programme] Erreur chargement:', e); }
}

function startProgrammeBackgroundSync() {
    chargerProgrammeBackground();
    if (programmeSyncTimer) clearInterval(programmeSyncTimer);
    programmeSyncTimer = setInterval(chargerProgrammeBackground, PROGRAMME_CACHE_DURATION);
}

function stopProgrammeBackgroundSync() {
    if (programmeSyncTimer) { clearInterval(programmeSyncTimer); programmeSyncTimer = null; }
}

// ===== INITIALISATION AUTOMATIQUE =====
document.addEventListener('DOMContentLoaded', function() {
    appliquerDarkModeInitial();
    initOfflineDetection();
    chargerCSSHeader();
    
    const chemin = window.location.pathname;
    if (!chemin.endsWith('app.html') && !chemin.endsWith('index.html')) {
        injecterHeaderPrincipal();
    }
    
    const adherent = chargerAdherent();
    if (adherent) {
        startMessagerieBackgroundSync();
        chargerListeAdherentsSilencieux();
        startProgrammeBackgroundSync();
    }
});

window.addEventListener('beforeunload', () => { 
    stopMessagerieBackgroundSync();
    stopProgrammeBackgroundSync();
});

// ==========================================
// MOTEUR DE PRÉCHARGEMENT EN ARRIÈRE-PLAN
// ==========================================
(function() {
    let backgroundInterval = null;

    async function updateAllCaches() {
        const userId = localStorage.getItem('userId');
        if (!userId || typeof SCRIPT_URL === 'undefined') return;

        console.log('[Background] Mise à jour silencieuse des données...');

        // 1. Mise à jour des infos utilisateur et Messages
        try {
            const respUser = await fetch(SCRIPT_URL + '?action=getAdherent&id=' + encodeURIComponent(userId));
            const dataUser = await respUser.json();
            
            if (dataUser.success) {
                // On garde les infos user à jour
                localStorage.setItem('aamb_adherent', JSON.stringify(dataUser.adherent));
                const isOrg = dataUser.adherent.statut === 'Organisateur';

                // On récupère les messages selon le rôle
                const actionMsg = isOrg ? 'getAllMessages' : 'getMyMessages';
                const respMsg = await fetch(SCRIPT_URL + '?action=' + actionMsg + '&userId=' + encodeURIComponent(userId));
                const dataMsg = await respMsg.json();
                
                if (dataMsg.success) {
                    localStorage.setItem('aamb_messages_cache', JSON.stringify({
                        timestamp: Date.now(),
                        data: dataMsg
                    }));
                }
            }
        } catch (e) {
            console.warn('[Background] Échec mise à jour user/messages:', e);
        }

        // 2. Mise à jour Vote AG & Chat AG
        try {
            const respVote = await fetch(SCRIPT_URL + '?action=getVoteAGData&userId=' + encodeURIComponent(userId));
            const dataVote = await respVote.json();
            if (dataVote.success) {
                localStorage.setItem('aamb_voteag_cache', JSON.stringify({
                    timestamp: Date.now(),
                    data: dataVote
                }));
            }
        } catch (e) {
            console.warn('[Background] Échec mise à jour Vote AG:', e);
        }

        try {
            const respChat = await fetch(SCRIPT_URL + '?action=getChatAG&userId=' + encodeURIComponent(userId));
            const dataChat = await respChat.json();
            if (dataChat.success) {
                localStorage.setItem('aamb_chatag_cache', JSON.stringify({
                    timestamp: Date.now(),
                    data: dataChat
                }));
            }
        } catch (e) {
            console.warn('[Background] Échec mise à jour Chat AG:', e);
        }
    }

    function startBackgroundSync() {
        if (backgroundInterval) return; // Déjà lancé
        
        // 1ère mise à jour immédiate
        updateAllCaches();
        
        // Puis mise à jour silencieuse toutes les 15 secondes
        // (15s est un bon compromis pour ne pas saturer les quotas Google Apps Script)
        backgroundInterval = setInterval(updateAllCaches, 15000);
        console.log('[Background] Synchronisation automatique activée (toutes les 15s)');
    }

    // Lancer le processus si l'utilisateur est déjà connecté
    if (localStorage.getItem('userId')) {
        setTimeout(startBackgroundSync, 2000); // Délai de 2s pour ne pas gêner le chargement initial
    }

    // Si l'utilisateur se connecte ou se déconnecte dans un autre onglet
    window.addEventListener('storage', (e) => {
        if (e.key === 'userId') {
            if (e.newValue) {
                setTimeout(startBackgroundSync, 2000);
            } else {
                if (backgroundInterval) clearInterval(backgroundInterval);
            }
        }
    });
})();
