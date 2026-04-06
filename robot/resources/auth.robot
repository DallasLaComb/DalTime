*** Settings ***
Documentation    Shared authentication keywords.
Library          Browser
Library          ${CURDIR}/cognito_auth.py
Resource         env.robot

*** Keywords ***
Login Via UI
    [Documentation]    Log in as the WebAdmin test user via the login page UI.
    New Browser    firefox    headless=${HEADLESS}    slowMo=${SLOW_MO}
    New Page       ${BASE_URL}/login
    Fill Text      [data-testid="email-input"]       ${WEB_ADMIN_EMAIL}
    Fill Text      [data-testid="password-input"]     ${WEB_ADMIN_PASSWORD}
    Click          [data-testid="sign-in-btn"]
    Wait For Navigation    url=${BASE_URL}/web-admin
    Get Url    ==    ${BASE_URL}/web-admin

Login With Tokens
    [Documentation]    Authenticate by injecting Cognito tokens into sessionStorage (skips UI).
    ${tokens}=    Initiate Auth    ${COGNITO_REGION}    ${COGNITO_CLIENT_ID}    ${WEB_ADMIN_EMAIL}    ${WEB_ADMIN_PASSWORD}
    New Browser    firefox    headless=${HEADLESS}    slowMo=${SLOW_MO}
    New Page       ${BASE_URL}
    Evaluate JavaScript    ${None}
    ...    (tokens) => {
    ...        sessionStorage.setItem('daltime_access_token', tokens.access_token);
    ...        sessionStorage.setItem('daltime_id_token', tokens.id_token);
    ...        if (tokens.refresh_token) sessionStorage.setItem('daltime_refresh_token', tokens.refresh_token);
    ...    }
    ...    arg=${tokens}
    Go To          ${BASE_URL}/web-admin
    Wait For Load State    networkidle
