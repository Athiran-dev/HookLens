// A stand-in for "your app", for trying HookLens without a real project.
// Prints every request it receives and answers 200.   Run:  node scripts\demo-app.js
const http = require("http");

const port = Number(process.env.PORT || 3000);

http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      console.log(`${new Date().toLocaleTimeString()}  ${req.method} ${req.url}`);
      console.log("   body:", body.replace(/\s+/g, " ").slice(0, 200) || "(empty)");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ received: true }));
    });
  })
  .listen(port, () => console.log(`Demo app listening on http://localhost:${port}  (Ctrl+C to stop)`));
