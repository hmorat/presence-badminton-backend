import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 CONNEXION POSTGRES (Render env var)
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONN,
  ssl: { rejectUnauthorized: false },
});

// ===============================
// 🔽 CRENEAUX
// ===============================
app.get("/api/creneaux", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM creneaux
      ORDER BY creneau_code ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR /creneaux:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ===============================
// 🔽 JOUEURS
// ===============================
app.get("/api/joueurs", async (req, res) => {
  try {
    const { creneau } = req.query;

    console.log("GET JOUEURS =", creneau);

    if (!creneau) {
      return res.json([]);
    }

    const result = await pool.query(
      `
      SELECT j.*
      FROM joueurs j
      WHERE j.licence::text IN (
        SELECT jc.licence::text
        FROM joueurs_creneaux jc
        WHERE jc.creneau_code = $1
      )
      ORDER BY j.nom ASC
      `,
      [creneau]
    );

    console.log("NB JOUEURS =", result.rows.length);

    res.json(result.rows);

  } catch (err) {
    console.error("ERREUR /joueurs:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ===============================
// 🔽 DATES (SAISON SEPT → AOUT)
// ===============================
app.get("/api/dates", async (req, res) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const startYear = month >= 8 ? year : year - 1;

    const start = new Date(startYear, 8, 1); // 1 sept
    const end = new Date(startYear + 1, 7, 31); // 31 août

    const dates = [];
    let current = new Date(start);

    while (current <= end) {
      dates.push({
        date_seance: current.toISOString(),
      });

      current.setDate(current.getDate() + 1);
    }

    res.json(dates);
  } catch (err) {
    console.error("ERREUR /dates:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ===============================
// 🔽 GET PRESENCES (pour affichage)
// ===============================
app.get("/api/joueurs", async (req, res) => {
  try {
    const { creneau } = req.query;

    console.log("GET JOUEURS:", creneau);

    if (!creneau) {
      return res.json([]);
    }

    const result = await pool.query(
      `
      SELECT j.*
      FROM joueurs j
      INNER JOIN joueurs_creneaux jc
        ON j.licence::text = jc.licence::text
      WHERE jc.creneau_code = $1
      ORDER BY j.nom ASC
      `,
      [creneau]
    );

    res.json(result.rows);

  } catch (err) {
    console.error("ERREUR /joueurs:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ===============================
// 🔽 SAVE PRESENCE (INSERT / UPDATE)
// ===============================
app.post("/api/presence", async (req, res) => {
  try {
    const { licence, creneau_code, date_seance, present } = req.body;

    console.log("SAVE:", licence, creneau_code, date_seance, present);

    await pool.query(
      `
      INSERT INTO presences (licence, creneau_code, date_seance, present)
      VALUES ($1, $2, DATE($3), $4)
      ON CONFLICT (licence, creneau_code, date_seance)
      DO UPDATE SET present = $4
      `,
      [licence, creneau_code, date_seance, present]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("ERREUR /presence:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ===============================
// 🔽 ROOT
// ===============================
app.get("/", (req, res) => {
  res.send("API Badminton OK");
});

// ===============================
// 🚀 START
// ===============================
const PORT = process.env.PORT || 10000;

app.get("/api/presences", async (req, res) => {
  try {
    const { creneau, date } = req.query;

    console.log("GET PRESENCES:", creneau, date);

    if (!creneau || !date) {
      return res.json([]);
    }

    const result = await pool.query(
      `
      SELECT licence, present
      FROM presences
      WHERE creneau_code = $1
      AND date_seance = DATE($2)
      `,
      [creneau, date]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR /presences:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur port ${PORT}`);
});