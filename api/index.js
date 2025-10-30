import serverless from "serverless-http";
import { createServer } from "../server";

const app = createServer();
const handler = serverless(app);

export default function (req, res) {
  return handler(req, res);
}