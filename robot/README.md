# E2E Tests (Robot Framework)

## Structure

```
robot/
├── requirements.txt          # Python dependencies
├── resources/
│   ├── env.robot             # Environment variables (URLs, emails)
│   └── auth.robot            # Login/logout keywords
└── tests/
    └── web-admin/
        └── smoke.robot       # WebAdmin smoke tests
```

## Setup

```bash
cd robot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
rfbrowser init
```

## Running locally

```bash
source .venv/bin/activate

# Run against dev (default)
robot \
  --outputdir results \
  --variable WEB_ADMIN_PASSWORD:your-password-here \
  tests/

# Run against a specific environment
robot \
  --outputdir results \
  --variable BASE_URL:https://qa.daltime.com \
  --variable WEB_ADMIN_EMAIL:robot-qa@daltime.com \
  --variable WEB_ADMIN_PASSWORD:your-password-here \
  tests/
```

## Pipeline

E2E tests run automatically after a successful CD deploy to dev or qa.
Credentials are stored as GitHub environment secrets (`E2E_WEB_ADMIN_PASSWORD`).

## Adding tests

1. Create a new `.robot` file under `tests/<role>/`
2. Use `Login As Web Admin` from `resources/auth.robot` for authenticated tests
3. Use `data-testid` attributes to locate elements
