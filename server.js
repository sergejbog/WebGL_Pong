const express = require("express");

const app = express();

app.use(express.static("public"));

console.log("Server is running on port 3000");

app.listen(3000);
