#!/usr/bin/env bash
set -euo pipefail
UPSTREAM=https://github.com/sst/models.dev.git
DEFAULT_BRANCH=$(git ls-remote --symref $UPSTREAM HEAD | sed -n 's#ref: refs/heads/##;s#\tHEAD##p')
git subtree pull --prefix vendor/models.dev $UPSTREAM $DEFAULT_BRANCH --squash
