import express from "express";
import pkg from "pg";
import ExcelJS from "exceljs";

const router = express.Router();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_CONN,
  ssl: { rejectUnauthorized: false },
});

/* =========================================================
   EXPORT EXCEL (⚠️ TOUJOURS EN PREMIER)
========================================================= */
router.get("/export/excel", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.date_seance,
        p.creneau_code,
        j.licence,
        j.prenom,
        j.nom,
        p.present
      FROM presences p
      LEFT JOIN joueurs j ON j.licence = p.licence
      ORDER BY p.date_seance, p.creneau_code
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Présences");

    sheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Créneau", key: "creneau", width: 12 },
      { header: "Licence", key: "licence", width: 12 },
      { header: "Prénom", key: "prenom", width: 15 },
      { header: "Nom", key: "nom", width: 20 },
      { header: "Présence", key: "presence", width: 12 },
    ];

    result.rows.forEach((row) => {
      sheet.addRow({
        date: row.date_seance
          ? new Date(row.date_seance).toLocaleDateString("fr-FR")
          : "",
        creneau: row.creneau_code,
        licence: row.licence,
        prenom: row.prenom || "",
        nom: row.nom || "",
        presence: row.present ? "Présent" : "Absent",
      });
    });

    // Headers HTTP pour téléchargement
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=export_presences.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erreur export Excel :", err);
    res.status(500).json({ error: "Erreur export Excel" });
  }
});

/* =========================================================
   GET PRESENCES PAR CRENEAU + DATE
========================================================= */
router.get("/:creneau/:date", async (req, res) => {
  const { creneau, date } = req.params;

  try {
    const result = await pool.query(
      `SELECT licence, present
       FROM presences
       WHERE creneau_code = $1 AND date_seance = $2`,
      [creneau, date]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Erreur GET presences :", err);
    res.status(500).json({ error: err.message });
  }
});

/* =========================================================
   POST / UPDATE PRESENCE
========================================================= */
router.post("/", async (req, res) => {
  const { licence, creneau_code, date_seance, present } = req.body;

  try {
    await pool.query(
      `INSERT INTO presences (licence, creneau_code, date_seance, present)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (licence, creneau_code, date_seance)
       DO UPDATE SET present = $4`,
      [licence, creneau_code, date_seance, present]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur POST presence :", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;