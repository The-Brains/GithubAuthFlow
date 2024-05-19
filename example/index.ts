import express from "express";
import path from "path";
import { GithubAuthServer } from "simple-github-authentication";

const app = express();
const port = parseInt(process.env.PORT ?? "3000");


const githubAuthServer = new GithubAuthServer(app, {
  rootPath: "/public/",
});

app.get("/public/is-node-server.json", (req, res) => {
  res.json(true)
});

app.get("/public/make-serverless.json", (req, res) => {
  githubAuthServer.active = req.query.serverless !== "true";
  res.json({
    serverless: !githubAuthServer.active,
  })
});

app.use('/public', express.static(path.join(import.meta.dir, 'public')));

app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
