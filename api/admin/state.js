import serverless from "serverless-http";
import { createServer } from "../../server/index.js";

const app = createServer();
const handler = serverless(app);

export default handler;