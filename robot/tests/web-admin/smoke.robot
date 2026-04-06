*** Settings ***
Documentation    WebAdmin E2E smoke tests (authenticated via token injection).
Library          Browser
Resource         ../../resources/auth.robot

Suite Setup      Login With Tokens
Suite Teardown   Close Browser

*** Test Cases ***
WebAdmin Dashboard Loads
    [Documentation]    After token-based auth, the web-admin dashboard should be visible.
    Get Text    h2    contains    Web Admin Dashboard

Navigate To Organizations
    [Documentation]    Clicking Organizations in the navbar loads the organizations page.
    Click             a >> text=Organizations
    Wait For Elements State    h2 >> text=Organizations    visible    timeout=10s
    Get Url    contains    /web-admin/organizations

Organizations Page Shows Table Or Empty State
    [Documentation]    The organizations page should show either org rows or an empty state.
    Wait Until Keyword Succeeds    10s    500ms    Page Has Orgs Or Empty State

*** Keywords ***
Page Has Orgs Or Empty State
    ${has_orgs}=      Get Element Count    [data-testid="org-row"]
    ${has_empty}=     Get Element Count    [data-testid="empty-state"]
    Should Be True    ${has_orgs} > 0 or ${has_empty} > 0
