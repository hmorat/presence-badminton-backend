import express from "express";
import cors from "cors";

import joueurs from "./routes/joueurs.js";
import seances from "./routes/seances.js";
import presences from "./routes/presences.js";
import creneaux from "./routes/creneaux.js";
import statsRouter from "./routes/stats.js";

const app = express();

app.use(cors());
app.use(express.json());

/* ===== ROUTES ===== */
app.use("/api/joueurs", joueurs);
app.use("/api/seances", seances);
app.use("/api/presences", presences);
app.use("/api/creneaux", creneaux);
app.use("/api", statsRouter);

/* ===== SERVER ===== */
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("API running on port " + PORT);
});