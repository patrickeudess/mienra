// Harnais de test sans dépendance : charge app-pro.js dans un bac à sable
// (avec des stubs DOM/navigateur), puis expose l'état et les fonctions utiles
// via globalThis.__app. Chaque test reçoit une instance FRAÎCHE.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP_PATH = path.join(__dirname, "..", "app-pro.js");

function loadApp() {
  const store = {};
  const el = () => ({
    innerHTML: "", value: "", style: {},
    setAttribute() {}, removeAttribute() {}, hasAttribute() { return false; },
    classList: { add() {}, remove() {} },
    appendChild() {}, addEventListener() {}, querySelector: () => el(), querySelectorAll: () => [],
  });
  const sb = {
    console, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean,
    isNaN, parseInt, parseFloat, Intl, RegExp, requestAnimationFrame: (fn) => fn && fn(),
    setTimeout: () => {}, clearTimeout: () => {}, alert: () => {}, confirm: () => true, prompt: () => null,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    navigator: { userAgent: "node", language: "fr" },
    document: {
      getElementById: () => el(), createElement: () => el(),
      querySelector: () => el(), querySelectorAll: () => [], body: el(),
      documentElement: { setAttribute() {}, removeAttribute() {} }, addEventListener: () => {},
    },
    location: { href: "http://localhost/", reload() {} },
  };
  sb.window = sb;
  sb.globalThis = sb;
  sb.window.MIENRA_CLOUD = { enabled: false }; // pas d'appels réseau pendant les tests
  sb.supabase = undefined;
  vm.createContext(sb);

  const src = fs.readFileSync(APP_PATH, "utf8");
  // Épilogue exécuté dans la même portée que `let state` : on expose ce dont
  // les tests ont besoin (lecture/écriture de l'état + fonctions).
  const epilogue = `
    globalThis.__app = {
      get state() { return state; }, set state(v) { state = v; },
      mergeStates, normalizeState, normalizeTombstones,
      uid, due, paid, balance, student, classFee, enrollmentNet, currentYear,
      financeStatus, statusBadge, clean, whatsappNumber,
      nextReceiptNumber: (typeof nextReceiptNumber === "function" ? nextReceiptNumber : null)
    };`;
  vm.runInContext(src + "\n" + epilogue, sb);
  return sb.__app;
}

// Mini collecteur d'assertions.
function makeT() {
  const failures = [];
  let count = 0;
  const t = {
    ok(cond, name) { count++; if (!cond) failures.push(name); },
    eq(a, b, name) { count++; if (a !== b) failures.push(`${name} (attendu ${b}, obtenu ${a})`); },
    get count() { return count; },
    get failures() { return failures; },
  };
  return t;
}

module.exports = { loadApp, makeT };
