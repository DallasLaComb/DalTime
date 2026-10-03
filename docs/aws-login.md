## Daily Login

One command authenticates all three profiles:

```bash
aws sso login --sso-session daltime
```

## Verify Access

```bash
aws sts get-caller-identity --profile daltime-dev
aws sts get-caller-identity --profile daltime-qa
aws sts get-caller-identity --profile daltime-prod
```
