import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// =============================
// CONNEXION POSTGRES (SUPABASE)
// =============================
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONN,
  ssl: { rejectUnauthorized: false },
});

// =============================
// ROUTE TEST
// =============================
app.get("/", (req, res) => {
  res.send("API OK 🚀");
});

// =============================
// CRENEAUX
// =============================
app.get("/api/creneaux", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT creneau_code, jour, gymnase, horaire, entraineur
      FROM creneaux
      ORDER BY creneau_code
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR /creneaux :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================
// DATES
// =============================
app.get("/api/dates", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT date_seance
      FROM presences
      ORDER BY date_seance DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR /dates :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================
// JOUEURS
// =============================
app.get("/api/joueurs", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT licence, nom, prenom
      FROM joueurs
      ORDER BY nom ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("ERREUR /joueurs :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================
// STATS (optionnel mais utile)
// =============================
app.get("/api/stats", async (req, res) => {
  try {
    const { creneau, date } = req.query;

    console.log("FILTERS:", creneau, date);

    const result = await pool.query(
      `
      SELECT 
        j.licence,
        j.nom,
        j.prenom,
        COUNT(p.id) AS total,
        COUNT(CASE WHEN p.present = true THEN 1 END) AS presents
      FROM joueurs j
      LEFT JOIN presences p 
        ON j.licence::text = p.licence::text
        AND ($1::text IS NULL OR p.creneau_code = $1)
        AND ($2 IS NULL OR p.date_seance = DATE($2))
      GROUP BY j.licence, j.nom, j.prenom
      HAVING COUNT(p.id) > 0
      ORDER BY j.nom ASC
      `,
      [creneau || null, date || null]
    );

    res.json({ joueurs: result.rows });

  } catch (err) {
    console.error("ERREUR STATS:", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// =============================
// LANCEMENT SERVEUR
// =============================
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Serveur lancé sur port ${PORT}`);
});