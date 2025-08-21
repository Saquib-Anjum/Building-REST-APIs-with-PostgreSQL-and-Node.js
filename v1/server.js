import express from "express";
import dotenv from "dotenv";
dotenv.config();
const app = express();
//config
app.use(express.json());

//api end point

//listinging the app
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server is running on port ${PORT} | http://localhost:${PORT}`);
});
