const json = require("../package");
const fs = require("fs");

fs.writeFileSync("ide/js/version.js", `export const version = "${json['version']}" ;`);
