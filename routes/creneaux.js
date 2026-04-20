import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         creneau_code,
         jour,
         gymnase,
         horaire,
         entraineur
       FROM creneaux
       ORDER BY jour, horaire`
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;