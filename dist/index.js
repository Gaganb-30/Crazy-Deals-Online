import express from "express";
const PORT = 3000;
const app = express();
app.get('/', (req, res) => {
    console.log("Get request");
    return res.json({ msg: "GET request" });
});
app.listen(PORT, () => console.log("Server started at PORT : " + PORT));
