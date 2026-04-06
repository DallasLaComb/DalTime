*** Settings ***
Documentation    WebAdmin organization CRUD E2E tests.
Library          Browser
Library          String
Resource         ../../resources/auth.robot

Suite Setup      Login With Tokens
Suite Teardown   Close Browser

*** Variables ***
${TEST_ORG_NAME}       Robot Test Org
${TEST_ORG_ADDRESS}    123 Automation Lane

*** Test Cases ***
Navigate To Organizations Page
    [Documentation]    Navigate to the organizations page.
    Click             a >> text=Organizations
    Wait For Elements State    [data-testid="create-org-btn"]    stable    timeout=10s
    Get Url    contains    /web-admin/organizations

Create Organization Via Modal
    [Documentation]    Open the create modal, fill in name and address, and save.
    Wait For Elements State    [data-testid="create-org-btn"]    stable    timeout=5s
    Click                      [data-testid="create-org-btn"]
    Wait For Elements State    [data-testid="org-modal"]    visible    timeout=5s
    Fill Text                  [data-testid="org-name-input"]       ${TEST_ORG_NAME}
    Fill Text                  [data-testid="org-address-input"]    ${TEST_ORG_ADDRESS}
    Wait For Elements State    [data-testid="save-org-btn"]    stable    timeout=5s
    Click                      [data-testid="save-org-btn"]
    Wait For Elements State    [data-testid="org-modal"]    hidden    timeout=10s

Created Organization Appears In List
    [Documentation]    The newly created org should appear in the list with correct name and address.
    Wait Until Keyword Succeeds    10s    500ms    Org Row Exists    ${TEST_ORG_NAME}

Click Into Organization Shows UUID In URL
    [Documentation]    Clicking Manage Admins navigates to a URL containing a UUID org ID.
    Wait Until Keyword Succeeds    10s    500ms    Click Visible Button For Org    ${TEST_ORG_NAME}    manage-admins-btn
    Wait For Elements State    [data-testid="page-heading"]    visible    timeout=10s
    ${url}=    Get Url
    Should Match Regexp    ${url}    /web-admin/organizations/[0-9a-f\\-]{36}/org-admins

Navigate Back And Delete Test Organization
    [Documentation]    Go back to organizations and delete the test org to clean up.
    Click             [data-testid="back-link"]
    Wait For Elements State    [data-testid="create-org-btn"]    stable    timeout=10s
    Wait Until Keyword Succeeds    10s    500ms    Org Row Exists    ${TEST_ORG_NAME}
    Wait Until Keyword Succeeds    10s    500ms    Click Visible Button For Org    ${TEST_ORG_NAME}    delete-org-btn
    Wait For Elements State    [data-testid="delete-modal"]    visible    timeout=5s
    Wait For Elements State    [data-testid="confirm-delete-btn"]    stable    timeout=5s
    Click                      [data-testid="confirm-delete-btn"]
    Wait For Elements State    [data-testid="delete-modal"]    hidden    timeout=10s

Deleted Organization No Longer In List
    [Documentation]    After deletion, the test org should not appear in the list.
    Wait Until Keyword Succeeds    10s    500ms    Org Row Gone    ${TEST_ORG_NAME}

*** Keywords ***
Org Row Exists
    [Arguments]    ${name}
    ${elements}=    Get Elements    [data-testid="org-name"]
    FOR    ${el}    IN    @{elements}
        ${is_visible}=    Get Element States    ${el}    then    bool(value & visible)
        IF    ${is_visible}
            ${text}=    Get Text    ${el}
            IF    '${text}' == '${name}'    RETURN
        END
    END
    Fail    Organization '${name}' not found

Org Row Gone
    [Arguments]    ${name}
    ${elements}=    Get Elements    [data-testid="org-name"]
    FOR    ${el}    IN    @{elements}
        ${is_visible}=    Get Element States    ${el}    then    bool(value & visible)
        IF    ${is_visible}
            ${text}=    Get Text    ${el}
            IF    '${text}' == '${name}'
                Fail    Organization '${name}' still exists
            END
        END
    END

Click Visible Button For Org
    [Documentation]    Find the visible button matching testid for a specific org name.
    [Arguments]    ${org_name}    ${button_testid}
    ${names}=      Get Elements    [data-testid="org-name"]
    ${buttons}=    Get Elements    [data-testid="${button_testid}"]
    FOR    ${name}    ${btn}    IN ZIP    ${names}    ${buttons}
        ${is_visible}=    Get Element States    ${name}    then    bool(value & visible)
        IF    ${is_visible}
            ${text}=    Get Text    ${name}
            IF    '${text}' == '${org_name}'
                Wait For Elements State    ${btn}    stable    timeout=5s
                Click    ${btn}
                RETURN
            END
        END
    END
    Fail    Button '${button_testid}' not found for org '${org_name}'
