# AWS SSO CLI Setup

SSO Start URL: `https://daltime.awsapps.com/start`
Region: `us-east-1`

## First-time setup

Run this once per profile you want to configure:

```bash
aws configure sso
```

When prompted:

| Prompt | Value |
|--------|-------|
| SSO session name | `daltime` |
| SSO start URL | `https://daltime.awsapps.com/start` |
| SSO region | `us-east-1` |
| SSO registration scopes | `sso:account:access` (default, just press Enter) |

A browser window will open — approve the request in AWS access portal.

After browser auth, the CLI will list your available accounts. Select the account and role for the profile you are configuring, then choose a profile name (e.g. `daltime-dev`, `daltime-qa`, `daltime-prod`).

Repeat for each environment.

---

## Recommended profile names

| Environment | AWS Account | Suggested Profile Name |
|-------------|-------------|------------------------|
| Dev | 737780202102 | `daltime-dev` |
| QA | 792761026828 | `daltime-qa` |
| Prod | 898147176258 | `daltime-prod` |

---

## Signing in (daily use)

SSO sessions expire (typically 8–12 hours). Re-authenticate with:

```bash
# Sign in to all profiles under the daltime SSO session at once
aws sso login --sso-session daltime
```

Or sign in to a specific profile:

```bash
aws sso login --profile daltime-dev
```

---

## Using a profile

Pass `--profile` to any AWS CLI command:

```bash
aws s3 ls --profile daltime-dev
aws cloudformation describe-stacks --profile daltime-qa
```

Or set it for your entire shell session:

```bash
export AWS_PROFILE=daltime-dev
aws s3 ls  # no --profile needed
```

---

## Checking who you are

```bash
aws sts get-caller-identity --profile daltime-dev
```

---

## ~/.aws/config reference

After running `aws configure sso`, your `~/.aws/config` will look like this:

```ini
[sso-session daltime]
sso_start_url = https://daltime.awsapps.com/start
sso_region = us-east-1
sso_registration_scopes = sso:account:access

[profile daltime-dev]
sso_session = daltime
sso_account_id = 737780202102
sso_role_name = <your-role-name>
region = us-east-1
output = json

[profile daltime-qa]
sso_session = daltime
sso_account_id = 792761026828
sso_role_name = <your-role-name>
region = us-east-1
output = json

[profile daltime-prod]
sso_session = daltime
sso_account_id = 898147176258
sso_role_name = <your-role-name>
region = us-east-1
output = json
```

Replace `<your-role-name>` with the IAM Identity Center permission set name you were assigned (visible during `aws configure sso` or in the AWS access portal).
