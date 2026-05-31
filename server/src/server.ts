import app from "./app.js";
import { verifySMTP } from "./lib/email.js";
import { log } from "./lib/logger.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  log("info", `Server is running on port ${PORT}`);
  await verifySMTP();
});
