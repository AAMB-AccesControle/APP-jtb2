// ============================================
// AAMB - Code commun partagé entre toutes les pages
// ============================================

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwPRnmLYoYp5swgYsFp0Xe7JjR1POS-0tZX8dr4SPOVJkZ6XZfz8VTwQ9nWpgMbZU8KjA/exec';

// ===== GESTION ADHÉRENT =====
function chargerAdherent() {
    const ls = localStorage.getItem('aamb_adherent');
    if (ls) return JSON.parse(ls);
    const c = document.cookie.split(';').find(c => c.trim().startsWith('aamb_adherent='));
    if (c) return JSON.parse(decodeURIComponent(c.split('=')[1]));
    return null;
}

function sauvegarderAdherent(a) {
    localStorage.setItem('aamb_adherent', JSON.stringify(a));
    const exp = new Date(Date.now() + 30*24*60*60*1000).toUTCString();
    document.cookie = 'aamb_adherent=' + encodeURIComponent(JSON.stringify(a)) + '; expires=' + exp + '; path=/';
}

function estOrganisateur() {
    const a = chargerAdherent();
    return a && a.statut === 'Organisateur';
}

function deconnecter() {
    if (!confirm('Voulez-vous vraiment vous déconnecter ?')) return;
    localStorage.removeItem('aamb_adherent');
    document.cookie = 'aamb_adherent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    window.location.href = getRacine() + 'index.html';
}

// Vérifie la connexion et redirige si nécessaire (à appeler sur chaque page sauf app.html/index.html)
function verifierConnexionOuRediriger() {
    const adherent = chargerAdherent();
    if (!adherent) {
        window.location.href = getRacine() + 'app.html';
        return null;
    }
    return adherent;
}

// Calcule le chemin relatif vers la racine du site selon la profondeur de la page actuelle
function getRacine() {
    const path = window.location.pathname;
    const depth = path.split('/').filter(p => p && !p.includes('.html')).length;
    // Si on est dans /pages/xxx.html -> depth compte le dossier "pages"
    if (path.includes('/pages/')) return '../';
    return './';
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
// Affiche le nom de l'utilisateur dans le header si l'élément #headerUser existe
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

// ===== INITIALISATION AUTOMATIQUE AU CHARGEMENT =====
document.addEventListener('DOMContentLoaded', function() {
    appliquerDarkModeInitial();
    afficherInfosUtilisateur();
});
