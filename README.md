# 🛡️ Security AI Incident Analyzer

AI-powered security incident analysis and classification system built with React and Claude AI. Designed for security companies to quickly classify, prioritize, and respond to security incidents using natural language processing.

![React](https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.0-646CFF?logo=vite&logoColor=white)
![Claude AI](https://img.shields.io/badge/Claude_AI-Sonnet_4-orange?logo=anthropic&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **AI-Powered Analysis** — Uses Claude AI (Anthropic) to automatically classify security incidents by severity, type, and priority score
- **Slovenian NLP** — Full natural language processing in Slovenian language
- **Threat Classification** — Automatic categorization into 9 incident types (break-in, vandalism, fire, theft, etc.)
- **Priority Scoring** — AI assigns a 1-100 priority score based on incident severity and risk factors
- **Risk Assessment** — Identifies key risk factors and generates recommended response actions
- **Real-time Dashboard** — Animated statistics, severity distribution bar, and type breakdown
- **Demo Mode** — Works without API key using simulated AI responses for demonstration

## 🖥️ Screenshots

The application features a dark, security-themed interface with:
- Incident input with sample data for quick testing
- Real-time stat cards with animated counters
- Incident list with severity badges and priority scores
- Detailed analysis panel with severity scale visualization

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/security-ai-analyzer.git
cd security-ai-analyzer

# Install dependencies
npm install

# (Optional) Add your Anthropic API key for real AI analysis
cp .env.example .env
# Edit .env and add your key from https://console.anthropic.com/

# Start development server
npm run dev
```

The app runs in **Demo Mode** without an API key — all features work with simulated AI responses.

### Build for Production

```bash
npm run build
npm run preview
```

## 🏗️ Tech Stack

| Technology | Purpose |
|---|---|
| **React 18** | UI framework with hooks (useState, useEffect, useRef, useCallback) |
| **Vite 5** | Build tool and dev server |
| **Claude AI API** | Natural language processing and incident classification |
| **CSS-in-JS** | Custom styled components with animations |
| **Google Fonts** | JetBrains Mono + Plus Jakarta Sans typography |

## 📐 Architecture

```
src/
├── main.jsx          # App entry point
├── index.css         # Global styles & animations
└── App.jsx           # Main application
    ├── Config        # Severity levels, incident types, sample data
    ├── API Service   # Claude AI integration with demo fallback
    ├── Components    # AnimatedNumber, PulsingDot, SeverityBar
    └── Dashboard     # Stats, incident list, detail panel
```

### Key Design Decisions

- **Demo Mode Fallback**: App works without API key using realistic mock data, making it deployable as a static site
- **Slovenian Language**: Full UI and AI prompts in Slovenian, demonstrating multilingual NLP capabilities
- **Security Domain**: Incident types and severity levels modeled after real security industry standards
- **Responsive Design**: CSS Grid layout adapts from single-column to split-panel view

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_ANTHROPIC_API_KEY` | No | Anthropic API key for real AI analysis. App runs in demo mode without it. |

## 🌐 Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Add `VITE_ANTHROPIC_API_KEY` in Vercel dashboard → Settings → Environment Variables.

### Netlify

```bash
npm run build
# Deploy dist/ folder to Netlify
```

## 📝 How It Works

1. **Input**: User describes a security incident in natural language (Slovenian)
2. **AI Processing**: The description is sent to Claude AI with a structured prompt
3. **Classification**: AI returns JSON with severity, type, summary, recommended response, risk factors, and priority score
4. **Visualization**: Results are rendered in an interactive dashboard with animations

### AI Prompt Engineering

The system uses a carefully crafted prompt that instructs Claude to:
- Classify severity as `critical`, `high`, `medium`, or `low`
- Categorize into predefined incident types
- Generate a one-sentence summary
- Recommend 2-3 sentence response actions
- Identify top 3 risk factors
- Assign a numerical priority score (1-100)

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ and AI
