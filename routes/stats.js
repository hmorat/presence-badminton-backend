import express from "express";
import pkg from "pg";

const { Pool } = pkg;
const router = express.Router();

/* ===== DATABASE ===== */
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONN,
  ssl: {
    rejectUnauthorized: false,
  },
});

/* ===== ROUTE TEST SIMPLE ===== */
router.get("/stats", async (req, res) => {
  try {
    // Test 1 : connexion OK ?
    const test = await pool.query("SELECT NOW()");
    console.log("Connexion OK :", test.rows);

    // Test 2 : lire table joueurs (simple)
    const joueurs = await pool.query("SELECT * FROM joueurs LIMIT 10");

    res.json({
      message: "Connexion OK",
      joueurs: joueurs.rows,
    });

  } catch (error) {
    console.error("Erreur stats :", error.message);

    res.status(500).json({
      error: error.message,
    });
  }
});

/* ===== EXPORT ===== */
export default router;