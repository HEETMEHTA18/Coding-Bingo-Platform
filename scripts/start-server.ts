import "dotenv/config";
import { createServer } from "../server/index.js";

const app = createServer();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✓ Server started on http://localhost:${PORT}`);
  console.log(`  Ready to test API endpoints!`);
});
