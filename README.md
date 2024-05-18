# SimpleGithubAuthentication
Github authentication flow made easy

## Description

To perform Github operation, you need an authToken. This can be a personal token from your Github account, or an authToken optained by authenticating with an app.
This repo provides a server code for simplifying the workflow.

## Setup

1. Register a new Github app
2. Take note of the app_id, client_id / client_secret
3. Setup this package on a Node.js server
4. Pre-fill with the appID, client ID and secret from environment variables.
5. Get the callbackUrl and fill it in your Github app.
6. Use the loginUrl to request the login.
7. You will be taken to the Github authentication, where a login window will popup asking to authorize your app.
8. You will be taken to the "callback_url" you chose, with the authToken passed as query parameters.

## Login

Use the login URL. It should be something like:
"https://<your-server>/github/login/<app_id>?callback=<your-callback_url>

## Registering new apps in the server

The server allows registering new apps with client_id / client_secret on the fly. This is mainly for testing purposes, but it can also be useful if you want a Github server responsible for authenticating multiple apps.
