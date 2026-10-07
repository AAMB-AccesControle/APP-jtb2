// ============================================
// AAMB - Code commun partagé entre toutes les pages
// Namespace pour éviter la pollution globale
// ============================================
const AAMB = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwPRnmLYoYp5swgYsFp0Xe7JjR1POS-0tZX8dr4SPOVJkZ6XZfz8VTwQ9nWpgMbZU8KjA/exec',
    config: {},
    utils: {}
};

// Alias pour compatibilité avec le code existant
const SCRIPT_URL = AAMB.SCRIPT_URL;

// ===== GESTION ADHÉRENT =====
function chargerAdherent() {
    try {
        const ls = localStorage.getItem('aamb_adherent');
        if (ls) return JSON.parse(ls);
        const c = document.cookie.split(';').find(c => c.trim().startsWith('aamb_adherent='));
        if (c) return JSON.parse(decodeURIComponent(c.split('=')[1]));
    } catch (e) {
        console.error('Erreur chargement adhérent:', e);
    }
    return null;
}

function sauvegarderAdherent(a) {
    try {
        localStorage.setItem('aamb_adherent', JSON.stringify(a));
        const exp = new Date(Date.now() + 30*24*60*60*1000).toUTCString();
        document.cookie = 'aamb_adherent=' + encodeURIComponent(JSON.stringify(a)) + '; expires=' + exp + '; path=/; SameSite=Lax';
    } catch (e) {
        console.error('Erreur sauvegarde adhérent:', e);
    }
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

// Vérifie la connexion et redirige si nécessaire
function verifierConnexionOuRediriger() {
    const adherent = chargerAdherent();
    if (!adherent) {
        window.location.href = getRacine() + 'app.html';
        return null;
    }
    return adherent;
}

// Calcule le chemin relatif vers la racine du site
function getRacine() {
    // Version robuste : détecte simplement si on est dans /pages/
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

// ===== EN-TÊTE STANDARD POUR LES SOUS-PAGES =====
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
    banner.textContent = '️ Vous êtes hors ligne';
    document.body.appendChild(banner);
    
    window.addEventListener('offline', () => { banner.style.display = 'block'; });
    window.addEventListener('online', () => { banner.style.display = 'none'; });
    
    if (!navigator.onLine) banner.style.display = 'block';
}

// ===== GESTION D'ERREUR GLOBALE =====
window.addEventListener('error', (e) => {
    console.error('Erreur globale:', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesse rejetée:', e.reason);
});

// ===== INITIALISATION AUTOMATIQUE AU CHARGEMENT =====
document.addEventListener('DOMContentLoaded', function() {
    appliquerDarkModeInitial();
    afficherInfosUtilisateur();
    initOfflineDetection();
});
