# micro-insuranceassistant

A clean FastAPI-based micro-insurance assistant application powered by Python 3.10+ and the Google GenAI SDK.

## Project Structure

```text
micro-insuranceassistant/
├── .env.example         # Environment template
├── .gitignore           # Git ignore rules
├── requirements.txt     # Pinned Python dependencies
├── README.md            # Setup and usage instructions
├── main.py              # FastAPI application entry point
├── data/                # Data storage, schemas, and reference datasets
├── services/            # Business logic and external service integrations (e.g. Gemini)
├── uploads/             # Temporary/incoming user document uploads
├── samples/             # Sample claim documents and test inputs
├── tests/               # Test suites (pytest)
└── static/
    └── js/              # Client-side JavaScript assets
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
   pip install -r requirements.txt
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
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Alternatively, run directly via Python:
```bash
python main.py
```

- **Interactive API Documentation (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative Documentation (ReDoc):** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check Endpoint:** [http://localhost:8000/health](http://localhost:8000/health)

## Running Tests

Execute the test suite using `pytest`:

```bash
pytest
```
