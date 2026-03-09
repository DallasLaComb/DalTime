*** Settings ***
Library    Browser

*** Variables ***
${ENV}          dev
${DEV_URL}      https://d21xwql5otog2e.cloudfront.net

*** Test Cases ***
Homepage loads successfully
    [Documentation]    Verify the frontend loads and returns a valid page title
    New Browser    chromium    headless=true
    New Page       ${DEV_URL}
    Get Title      contains    DalTime
    Close Browser
