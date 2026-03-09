# E2E Tests (Robot Framework)

## Setup

```bash
cd robot

# Create a Python virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Initialize Playwright browsers (downloads Chromium, Firefox, WebKit)
rfbrowser init
```

## Running tests

```bash
# Make sure the venv is active
source .venv/bin/activate

# Run all tests
robot .

# Run with results output to a specific directory
robot --outputdir results .
```

## Deactivating the venv

```bash
deactivate
```
