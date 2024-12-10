#!/bin/bash

if [ -z "$GIT_REPO_URL" ]; then
    echo "GIT_REPO_URL is not set"
    exit 1
fi

echo "Cloning repository from: $GIT_REPO_URL"
git clone "$GIT_REPO_URL" /home/app/output || { echo "Git clone failed"; exit 1; }

exec node script.js
