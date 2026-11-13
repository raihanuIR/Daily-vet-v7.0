# 🐾 DailyVet v7.0

**AI-powered animal care and climate-risk platform for farmers and pet owners in Bangladesh.**
Bilingual (English / বাংলা), mobile-first, installable as a PWA.

DailyVet helps livestock, poultry and pet owners diagnose problems early, find medicine and
nearby vets, plan feed, and stay ahead of climate risks such as floods, heat stress and
disease outbreaks, using AI plus NASA and weather data.

---

## ✨ Features

### 🩺 Animal health
| Feature | Page | What it does |
|---|---|---|
| **AI Doctor** | `ai.html` | Chat (text + photo) about symptoms for cattle, buffalo, goat, sheep, poultry, ducks, pigeons, dogs, cats, rabbits, fish and more. Understands English, Bangla and Banglish. |
| **Breed Detection** | `breed-detection.html` | Upload a photo to identify species, breed, sex and health signs, with buying advice. |
| **Dung & Urine Test** | `excreta-scan.html` | Photo-based screening of droppings or urine for parasite and health indicators. |
| **Read Prescription** | `scanner.html` | Scans a prescription or medicine document and explains it in plain language. |
| **Find Medicine** | `pharma.html` | Medicine lookup by animal and disease. |
| **Find a Doctor** | `vet-home.html`, `vet-profile.html` | Browse registered vets, call or WhatsApp them, and see nearby vets from your location. |
| **Feed Plan** | `advisor.html` | Feed and nutrition guidance. |
| **Emergency** | `emergency.html` | Emergency help page. |

### 🌦️ Climate and farm risk
| Feature | Page |
|---|---|
| NASA Climate Dashboard | `climate-dashboard.html` |
| Division Risk Map | `climate-map.html` |
| Flood Warning | `climate-flood.html` |
| Heat Stress (THI) | `climate-thi.html` |
| Disease Risk Radar | `climate-outbreak.html` |
| Air Quality and UV Warning | `climate-air-quality.html` |
| Forage Plan | `climate-forage.html` |
| Socio-Economic Impact | `climate-impact.html` |
| **Field Shift: Rotation Explorer** | `rotation-compare.html`: compares 3 multi-season crop/forage rotations using soil moisture, NDVI, soil data, planting season, soil type and risk tolerance, with a printable plan |

### 👥 Accounts and community
- User registration and login, profile management
- Vet registration and vet profiles
- Community page and support center
- Notifications, language toggle (English / বাংলা)

---

## 🧰 Tech stack

- **Front end:** static HTML, CSS and vanilla JavaScript (no build step)
- **Backend / data:** Firebase (Firestore)
- **AI:** Google Gemini, with Groq and OpenRouter as fail-over, called through a serverless proxy
- **Climate / geo data:** NASA POWER, MODIS NDVI, SoilGrids, NASA GPM, SEDAC, Open-Meteo, GeoJSON maps of Bangladesh (divisions, districts, upazilas), Leaflet
- **Maps / location:** browser Geolocation, Google Places (optional), LocationIQ
- **Hosting:** Vercel or Netlify (serverless functions in `api/` and `netlify/functions/`)
- **PWA:** service worker (`sw.js`) for faster repeat visits

---

## 📁 Project structure

```
├── index.html            Landing page
├── home.html             Logged-in home
├── *.html                Feature pages (see tables above)
├── css/                  Stylesheets
├── js/                   Page logic, AI, auth, i18n, NASA/climate engines
│   ├── auth.js           Login / register / session
│   ├── auth-guard.js     Redirects to login before a protected page renders
│   ├── ai.js             AI Doctor logic (species/symptom detection, prompts)
│   ├── i18n.js, i18n-bn.js   English / Bangla translation + language dropdown
│   └── location-service.js   Location access + nearby vets
├── api/ai-proxy.js       Vercel serverless AI proxy
├── netlify/functions/    Netlify serverless AI proxy
├── data/                 Bangladesh GeoJSON boundaries
├── assets/               Images / logo
├── sw.js                 Service worker
├── vercel.json, netlify.toml   Hosting config
└── DEPLOY.md             Step-by-step deploy guide
```

---

## 🚀 Run locally

1. Clone the repo.
2. Open the folder in VS Code and install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**.

No build or install step is needed. See [DEPLOY.md](DEPLOY.md) for Netlify and Vercel.

## ☁️ Deploy

- **Vercel:** import the repo, Framework Preset = *Other*, leave build/output empty. `api/ai-proxy.js` is used automatically.
- **Netlify:** deploy the folder; `netlify.toml` routes `/api/ai-proxy` to the function.

### Environment variables (recommended)

Set these in your hosting dashboard instead of keeping keys in code:

| Variable | Purpose |
|---|---|
| `GEMINI_KEY_1` … `GEMINI_KEY_21` | Gemini API keys (rotated automatically) |
| `GROQ_KEY_1` … `GROQ_KEY_5` | Groq fail-over keys |
| `OPENROUTER_KEY_1` … `OPENROUTER_KEY_3` | OpenRouter fail-over keys |

AI fallback order: Gemini → Groq → OpenRouter.

---

## 🔒 Security notes (please read before going public)

This project is still hardening. Known items, with the full write-up in
`DailyVet_Phone_Login_Security_Report.pdf`:

- Login is currently phone-number based and the session is kept in browser storage; there is no server-verified session yet. The page guard in `auth-guard.js` only improves user experience and is not a security boundary.
- Firestore security rules must be reviewed and locked down (rules by authenticated `uid`, default deny).
- AI provider keys must **not** live in source. Revoke any key that has been committed and use environment variables.
- The AI proxy should verify a login token, rate-limit, and restrict CORS to your own domain.
- Planned: move to Firebase Authentication (Google sign-in or phone OTP) and `uid`-keyed data.

---

## ⚠️ Disclaimer

DailyVet gives informational guidance only. It is **not** a substitute for a licensed
veterinarian. Dosages and treatments must be confirmed by a qualified vet. Climate and
rotation scores are relative planning indices, not yield or outbreak forecasts.

---

## 📄 Version

**v7.0**: bilingual UI, improved species detection (poultry, birds and more, in English and Bangla), smarter rotation planning, login page guard, location auto-detect, redesigned language dropdown.
