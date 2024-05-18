import express from "express";
import path from "path";
import { GithubAuthServer } from "simple-github-authentication";

const app = express();
const port = parseInt(process.env.PORT ?? "3000");

new GithubAuthServer(app);

app.use('/', express.static(path.join(import.meta.dir, 'public')));


app.listen(port, () => {
  console.log(`Listening on port ${port}...`);
});
