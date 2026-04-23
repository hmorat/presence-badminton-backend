const express = require('express');
const router = express.Router();
const supabase = require('../db');

router.get('/', async (req, res) => {
  try {
    // On ne demande que les 3 colonnes qui marchent à coup sûr
    const { data, error } = await supabase
      .from('creneaux')
      .select('creneau_code, Jour, Horaire'); 

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;