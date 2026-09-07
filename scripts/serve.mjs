import { existsSync } from "node:fs";
import { previewServer } from "./lib/preview-server.mjs";

if (!existsSync("out/index.html")) {
  console.error("Run npm run build before npm start.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";
const server = previewServer("out");
server.on("error", (error) => {
  console.error(`Cannot start the preview (${error.code}). Set PORT to an available port.`);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`Preview: http://${host}:${server.address().port}`));
