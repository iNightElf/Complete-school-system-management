import app from "./app.js";
import { verifySMTP } from "./lib/email.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await verifySMTP();
});
