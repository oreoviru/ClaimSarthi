# micro-insuranceassistant

A clean FastAPI-based micro-insurance assistant application powered by Python 3.10+ and the Google GenAI SDK.

## Project Structure

```text
ClaimSarthi/
├── .env.example             # Environment template
├── .gitignore               # Git ignore rules
├── README.md                # Setup and usage instructions
├── frontend/                # Frontend UI (HTML, CSS, ES Modules, JS tests)
│   ├── index.html           # Main SPA shell & guided claim wizard UI
│   ├── styles.css           # Mobile-first & desktop responsive styles
│   ├── js/                  # Modular client-side JavaScript ES modules
│   └── tests/               # Node.js headless DOM/integration tests
└── backend/                 # FastAPI backend, OCR & rule engines, data & tests
    ├── main.py              # FastAPI ASGI entry point
    ├── server.py            # FastAPI server routes & static mounts
    ├── models.py            # Pydantic request/response schemas
    ├── run_demo.py          # Live Wi-Fi mobile & local demo launcher
    ├── requirements.txt     # Pinned Python dependencies
    ├── data/                # Reference policies & persisted claims JSON
    ├── services/            # Policy, OCR, validation, report, & store services
    ├── uploads/             # Incoming claim document uploads
    ├── samples/             # Bundled demo claim sample images
    └── tests/               # Python backend & API test suite (pytest)
```

## Prerequisites

- **Python 3.10+** (Python 3.10, 3.11, or 3.12 recommended)
- `pip` package manager

## Local Setup

1. **Clone or navigate to the repository:**
   ```bash
   cd ClaimSarthi
   ```

2. **Create and activate a virtual environment:**
   ```bash
   # Create virtual environment
   python3 -m venv venv

   # Activate on macOS / Linux:
   source venv/bin/activate

   # Activate on Windows (Command Prompt):
   # venv\Scripts\activate.bat

   # Activate on Windows (PowerShell):
   # .\venv\Scripts\Activate.ps1
   ```

3. **Install dependencies:**
   ```bash
   pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your Gemini API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key
   GEMINI_MODEL=gemini-3.5-flash-lite
   DEMO_FALLBACK=true
   ```

## Launching the Application

Start the development server with automatic reload:

```bash
uvicorn backend.server:app --reload --host 0.0.0.0 --port 8000
```

Alternatively, run directly via Python or launch the mobile Wi-Fi demo gateway:
```bash
python3 backend/run_demo.py
```

- **Interactive API Documentation (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative Documentation (ReDoc):** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check Endpoint:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

## Running Tests

Execute the Python and frontend JavaScript test suites:

```bash
pytest
node frontend/tests/test_claim_wizard.mjs
node frontend/tests/test_claim_activation.mjs
```
