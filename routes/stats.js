import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const { creneau } = req.query;

  try {
    let query;
    let values = [];

    if (creneau && creneau !== "ALL") {
      query = `
        SELECT 
          j.licence,
          j.nom,
          j.prenom,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE p.present = true) AS presents
        FROM presences p
        JOIN joueurs j 
          ON p.licence::text = j.licence::text
        WHERE p.creneau_code = $1
        GROUP BY j.licence, j.nom, j.prenom
        ORDER BY j.nom ASC
      `;
      values = [creneau];
    } else {
      query = `
        SELECT 
          j.licence,
          j.nom,
          j.prenom,
          COUNT(p.*) AS total,
          COUNT(*) FILTER (WHERE p.present = true) AS presents
        FROM joueurs j
        LEFT JOIN presences p 
          ON p.licence::text = j.licence::text
        GROUP BY j.licence, j.nom, j.prenom
        ORDER BY j.nom ASC
      `;
    }

    const result = await pool.query(query, values);

    res.json({ joueurs: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;