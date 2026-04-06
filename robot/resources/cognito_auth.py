"""Cognito auth helper for E2E tests — gets tokens via InitiateAuth."""
import json
import urllib.request
import urllib.error


def get_cognito_tokens(base_url: str, email: str, password: str) -> dict:
    """Call the app's login flow by hitting Cognito InitiateAuth directly.

    We need the Cognito client ID and region. We extract them from the app's
    JS bundle by fetching the login page — but that's fragile. Instead, we
    use a simpler approach: call InitiateAuth via the AWS SDK-style HTTP API.

    For simplicity, this uses the same USER_PASSWORD_AUTH flow the app uses.
    Requires: cognito client ID and region, which we pass as robot variables.
    """
    # This is called from Robot Framework with variables resolved there.
    raise NotImplementedError("Use the Robot Framework keyword instead")


def initiate_auth(region: str, client_id: str, email: str, password: str) -> dict:
    """Call Cognito InitiateAuth via HTTP and return the tokens."""
    url = f"https://cognito-idp.{region}.amazonaws.com/"
    payload = {
        "AuthFlow": "USER_PASSWORD_AUTH",
        "ClientId": client_id,
        "AuthParameters": {
            "USERNAME": email,
            "PASSWORD": password,
        },
    }
    headers = {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers)
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    auth = result["AuthenticationResult"]
    return {
        "access_token": auth["AccessToken"],
        "id_token": auth["IdToken"],
        "refresh_token": auth.get("RefreshToken", ""),
    }
