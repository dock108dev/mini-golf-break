# Security Audit — Mini Golf Break

**Date:** 2026-04-09
**Auditor:** Application Security Review (automated + manual code inspection)
**Scope:** Full client-side codebase (`src/`, `public/`, build config, deployment config)
**Project type:** Static client-side Three.js game — no backend, no authentication, no user accounts

---

## Executive Summary

Mini Golf Break is a purely client-side 3D browser game with no backend, no authentication, and no user-submitted content. The attack surface is narrow: the main risks are XSS via unsafe DOM rendering, information disclosure via debug features, dependency vulnerabilities in devDependencies, and missing HTTP security headers in deployment config.

**No critical vulnerabilities were found.** The codebase follows generally good practices — `textContent` is used in most places, ESLint enforces `no-eval` and `no-new-func`, and localStorage handling includes try-catch guards with Array.isArray validation. The findings below are hardening opportunities appropriate for a public-facing web application.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 5 |
| Low | 5 |
| Informational | 3 |

---

## 1. Confirmed Vulnerabilities

### V-01: innerHTML with Dynamic Keys in Debug Overlay (Medium)

**File:** `src/managers/ui/UIDebugOverlay.js:72-75`

```javascript
debugText += `<div><strong>${key}:</strong> ${value}</div>`;
this.debugElement.innerHTML = debugText;
```

**Evidence:** The `key` variable comes from `debugInfo` object keys, and `value` can be any game state including JSON.stringify output. While currently all sources are internal game state, the pattern is unsafe — if any debug info key or value contained `<script>` or event handlers, it would execute.

**Exploit scenario:** If a future developer adds user-controlled data to the debug overlay (e.g., player name, custom course name), it would be rendered as HTML without escaping.

**Severity:** Medium (debug overlay is only visible when debug mode is toggled on; values are currently all internal)

**Fix:** Replaced with safe DOM construction using `textContent` — see hardening changes below.

---

### V-02: innerHTML in Scorecard Table Rows (Low)

**File:** `src/managers/ui/UIScoreOverlay.js:181, 199, 209, 224`

```javascript
row.innerHTML = `<td>Hole ${index + 1}</td><td>${par}</td><td>${strokes}</td><td class="${diffClass}">${diffText}</td>`;
```

**Evidence:** Values (`par`, `strokes`, `index`) are numeric from the internal ScoringSystem. `diffClass` and `diffText` come from internal `_getDiffClass()` and `_formatDiff()` methods that return hardcoded strings. No user input reaches these values.

**Exploit scenario:** Extremely unlikely — would require ScoringSystem to return HTML-injection payloads from its internal numeric tracking. Noted as a defense-in-depth concern.

**Severity:** Low (all interpolated values are internally computed numbers/strings)

**Recommendation:** Convert to DOM API construction for defense-in-depth. Not changed in this audit to avoid regression risk in UI rendering.

---

### V-03: innerHTML in Performance Manager Display (Low)

**File:** `src/managers/PerformanceManager.js:452-476`

```javascript
let html = `<div style="font-weight: bold; ...">PERFORMANCE (${PERFORMANCE_CONFIG.toggleKey} to toggle)</div>`;
html += `<div>FPS: <span style="color: ${fpsColor}">${data.fps.current}</span>...`;
this.performanceDisplay.innerHTML = html;
```

**Evidence:** All values are numeric performance metrics from internal measurement. Color values are ternary-selected between two hardcoded hex strings. `PERFORMANCE_CONFIG.toggleKey` is a static config string.

**Severity:** Low (only visible in debug mode, all values internally computed)

**Recommendation:** Future refactor to DOM API. Low priority given debug-only visibility.

---

## 2. Risky Patterns / Hardening Opportunities

### H-01: Missing HTTP Security Headers in Deployment (High)

**File:** `vercel.json:16-43`

**Evidence:** Only `Cache-Control` headers are configured. Missing:
- `Content-Security-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

**Impact:** Without CSP, any injected script would execute. Without `X-Frame-Options`, the game could be embedded in a malicious site (clickjacking). Without `X-Content-Type-Options`, MIME-sniffing attacks are possible.

**Severity:** High (directly affects deployed application security posture)

**Fix applied:** Added security headers to `vercel.json` — see hardening changes below.

---

### H-02: Debug Features Accessible in Production via Config Flag (High)

**File:** `src/config/debugConfig.js:5, 19`

```javascript
enabled: false, // Set to true to enable debugging in production
courseDebug: {
  enabled: true, // Enable course debugging features
```

**Evidence:** The comment on line 5 explicitly contemplates enabling debug in production. `courseDebug.enabled` defaults to `true` regardless of environment. The `DebugManager.addMainKeyListener()` at `src/managers/DebugManager.js:53` does gate on `process.env.NODE_ENV !== 'production' || DEBUG_CONFIG.enabled`, so debug mode is correctly disabled in production when `DEBUG_CONFIG.enabled` is `false`.

However, `courseDebug.enabled: true` is misleading — the course debug UI initialization at `DebugManager.init()` also checks the main `enabled` state or `NODE_ENV`. The risk is that someone sets `enabled: true` based on the comment's suggestion.

**Severity:** High (the comment actively encourages enabling debug in production)

**Fix applied:** Updated comment to warn against production use — see hardening changes below.

---

### H-03: Global Window Object Exposure (Medium)

**File:** `src/main.js:228-230`

```javascript
window.App = new App();
window.game = window.App.game;
```

**Evidence:** The entire `App` and `Game` instances are exposed on the global `window` object. From the browser console, anyone can call `window.game.scoringSystem`, `window.game.ballManager`, `window.game.stateManager`, etc.

**Impact:** Players can manipulate game state, scores, physics, and state transitions via the console. For a single-player game with no server-side validation, this is mostly a fairness concern for localStorage high scores.

**Severity:** Medium (enables client-side score manipulation, but no competitive/monetary impact)

**Recommendation:** In production builds, avoid exposing on `window`. This is acceptable for development. Consider:
```javascript
if (process.env.NODE_ENV !== 'production') {
  window.App = app;
  window.game = app.game;
}
```

---

### H-04: Dependency Vulnerabilities — 30 Known Issues (Medium)

**Evidence:** `npm audit` reports 30 vulnerabilities (6 low, 5 moderate, 19 high).

Key affected packages:
| Package | Severity | Issue | Direct? |
|---------|----------|-------|---------|
| `@capacitor/cli` | High | Depends on vulnerable `tar` | Yes (devDep) |
| `@playwright/test` | High | Depends on vulnerable `playwright` | Yes (devDep) |
| `webpack` | High | SSRF via buildHttp allowedUris bypass | Yes (devDep) |
| `serialize-javascript` | High | RCE via RegExp/Date serialization | Transitive |
| `@isaacs/brace-expansion` | High | ReDoS | Transitive |
| `yaml` | Moderate | Stack overflow via deep nesting | Transitive |

**Mitigating factors:**
- All vulnerable packages are **devDependencies** — they are NOT shipped in the production bundle
- `@capacitor/cli` is listed as unused per project docs
- The `webpack` SSRF requires `buildHttp` feature which is not used
- `serialize-javascript` is only used during build, not at runtime
- `npm audit fix` reports fixes are available for most issues

**Severity:** Medium (devDependencies only; no runtime exposure; but blocks pre-commit hook)

**Recommendation:** Run `npm audit fix`. Remove unused `@capacitor/cli` and related Capacitor dependencies.

---

### H-05: localStorage High Scores Lack Integrity Protection (Medium)

**File:** `src/game/HighScoreManager.js:26, 60-65`

```javascript
localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
// ...
const parsed = JSON.parse(raw);
return Array.isArray(parsed) ? parsed : [];
```

**Evidence:** Scores are stored as plaintext JSON. Any user can open DevTools and edit `localStorage.miniGolfBreak_highScores` to set arbitrary scores.

**Severity:** Medium (no competitive multiplayer, but "Personal Best" display can be faked)

**Recommendation:** For a single-player game this is acceptable. If leaderboards are ever added, scores must be validated server-side. A lightweight client-side mitigation would be HMAC-signing stored scores, but this only raises the bar — determined users can still extract the key from bundled JS.

---

### H-06: Missing Content Security Policy in HTML (Medium)

**File:** `public/index.html`

**Evidence:** No `<meta http-equiv="Content-Security-Policy">` tag. The `window.gtag` check in `UIScoreOverlay.js:239` suggests Google Analytics may be loaded externally, but no GA script tag exists in `index.html`.

**Severity:** Medium (defense-in-depth; partially addressed by vercel.json headers fix)

**Recommendation:** Add a CSP meta tag as a fallback for non-Vercel deployments. The tag should allow `'self'` scripts, `'unsafe-inline'` styles (needed for Three.js canvas styling), and `data:` images. If Google Analytics is desired, add the GA domains explicitly.

---

### H-07: Unbounded Score Array Growth in localStorage (Low)

**File:** `src/game/HighScoreManager.js:21-25`

```javascript
const scores = HighScoreManager._loadScores();
scores.push({ totalStrokes, courseName, timestamp: Date.now() });
localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
```

**Evidence:** Every completed game appends to the array with no cap. Over many play sessions, this array grows without limit. localStorage has a ~5MB limit per origin; eventually writes will fail (caught by try-catch, so no crash).

**Severity:** Low (fails gracefully; would take thousands of games to approach limits)

**Recommendation:** Cap the array to the most recent N entries (e.g., 100) before saving.

---

### H-08: `window.location.reload()` Fallback Without User Confirmation (Low)

**Files:** `src/managers/UIManager.js:355`, `src/managers/ui/UIScoreOverlay.js:250`

```javascript
window.location.reload();
```

**Evidence:** Used as a fallback when `window.App.returnToMenu` is not available. This is triggered by user clicking "Play Again" so it's user-initiated, but reloads the entire page losing any unsaved state.

**Severity:** Low (user-initiated action; game state is already complete at this point)

---

### H-09: innerHTML in Debug Course UI (Low)

**File:** `src/managers/debug/DebugCourseUI.js:85-88`

```javascript
keyInfo.innerHTML = `
    Load Hole #: [${DEBUG_CONFIG.courseDebug.loadSpecificHoleKey}] <br>
    Quick Load: [1-9]
`;
```

**Evidence:** Interpolates a single character from a static config object. Only visible in debug mode.

**Severity:** Low (static config value, debug-only visibility)

---

## 3. Intentional / Acceptable Patterns

### A-01: Console Stripping in Production (Acceptable)

**File:** `webpack.config.js:124-126`

```javascript
compress: {
  drop_console: true,
  pure_funcs: ['console.log', 'console.info', 'console.debug'],
}
```

Terser strips `console.log/info/debug` in production. `console.warn` and `console.error` are intentionally preserved for runtime error visibility. This is a good balance.

### A-02: No Source Maps in Production (Acceptable)

**File:** `webpack.config.js`

No `devtool` property is set in production config, so webpack defaults to no source maps in production builds. This prevents source code exposure in deployed builds.

### A-03: Pre-commit Security Audit Hook (Good Practice)

**File:** `.husky/pre-commit:9-20`

The hook runs `npm audit --audit-level=high` and blocks commits with high/critical vulnerabilities. This is a good security gate, though it currently blocks commits due to the 19 high-severity devDependency issues.

### A-04: ESLint Security Rules (Good Practice)

**File:** `.eslintrc.json`

Enforces `no-eval`, `no-new-func`, `no-implied-eval`, and `eqeqeq`. These prevent the most common JavaScript code injection patterns.

### A-05: WebGL Availability Check (Good Practice)

**File:** `src/main.js:223-225`

```javascript
if (!isWebGLAvailable()) {
  showWebGLFallback();
  return;
}
```

Gracefully handles missing WebGL with a user-facing message instead of crashing.

---

## 4. Items Needing Manual Verification

### M-01: Google Analytics Integration

`UIScoreOverlay.js:239` calls `window.gtag()` if it exists. No GA script is loaded in `index.html`. Verify whether GA is loaded via a separate tag manager, Vercel analytics, or if this is dead code. If GA is active, ensure the GA property ID is correct and a CSP policy allows the GA domains.

### M-02: Capacitor Dependencies

`package.json` includes `@capacitor/cli`, `@capacitor/core`, `@capacitor/android`, `@capacitor/ios` per project docs noting they are "unused." Verify these are truly unused and remove them to reduce the dependency attack surface and fix several npm audit findings.

### M-03: `sitemap.xml` and `robots.txt` Domain Accuracy

`public/robots.txt` references `https://minigolfbreak.com/sitemap.xml`. Verify the domain is correct and owned. An incorrect sitemap URL could inadvertently direct crawlers to a malicious site.

### M-04: Production Build Verification

Verify that `NODE_ENV=production` is correctly set during Vercel builds so that:
- Debug logging is suppressed
- `debug.log()` calls are no-ops
- Terser console stripping takes effect
- The `DebugManager` NODE_ENV gate correctly prevents debug mode

---

## Safe Hardening Changes Applied

The following low-risk changes were made directly in this audit:

1. **`vercel.json`** — Added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` security headers to all responses
2. **`src/managers/ui/UIDebugOverlay.js`** — Replaced `innerHTML` with safe DOM construction using `textContent` and `createElement`
3. **`src/config/debugConfig.js`** — Updated misleading comment that suggested enabling debug in production

---

## Recommended Next Steps (Priority Order)

1. **Run `npm audit fix`** to resolve available dependency fixes
2. **Remove unused Capacitor dependencies** from `package.json`
3. **Add CSP meta tag** to `public/index.html` as defense-in-depth
4. **Guard `window.App`/`window.game` exposure** behind `NODE_ENV` check in production
5. **Convert remaining `innerHTML` usages** in `UIScoreOverlay.js` and `PerformanceManager.js` to DOM API (low urgency — values are all internally computed)
6. **Cap high score array** in `HighScoreManager.js` to prevent unbounded growth
