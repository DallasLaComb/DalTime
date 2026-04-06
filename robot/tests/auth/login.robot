*** Settings ***
Documentation    Tests the login UI flow.
Library          Browser
Resource         ../../resources/auth.robot
Resource         ../../resources/env.robot

Suite Teardown   Close Browser

*** Test Cases ***
Login Page Renders
    [Documentation]    The login page should show email, password, and sign in button.
    New Browser    firefox    headless=${HEADLESS}    slowMo=${SLOW_MO}
    New Page       ${BASE_URL}/login
    Get Element Count    [data-testid="email-input"]       ==    1
    Get Element Count    [data-testid="password-input"]     ==    1
    Get Element Count    [data-testid="sign-in-btn"]        ==    1

Login Shows Validation Errors
    [Documentation]    Clicking sign in with empty fields shows validation errors.
    New Browser    firefox    headless=${HEADLESS}    slowMo=${SLOW_MO}
    New Page       ${BASE_URL}/login
    Click          [data-testid="sign-in-btn"]
    Get Text       [data-testid="email-error"]       ==    Email is required
    Get Text       [data-testid="password-error"]    ==    Password is required

Login With Invalid Credentials Shows Error
    [Documentation]    Entering wrong credentials shows an error message.
    New Browser    firefox    headless=${HEADLESS}    slowMo=${SLOW_MO}
    New Page       ${BASE_URL}/login
    Fill Text      [data-testid="email-input"]       wrong@example.com
    Fill Text      [data-testid="password-input"]     WrongPassword123!
    Click          [data-testid="sign-in-btn"]
    Wait For Elements State    [data-testid="login-error"]    visible    timeout=10s

Login With Valid Credentials Redirects To Dashboard
    [Documentation]    Logging in with valid credentials redirects to the web-admin dashboard.
    Login Via UI
    Get Url    ==    ${BASE_URL}/web-admin
    Get Text    h2    contains    Web Admin Dashboard
