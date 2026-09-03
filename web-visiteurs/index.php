<?php
/** Formulaire public d'enregistrement des visiteurs (ouvert via QR Code). */
require __DIR__ . '/db.php';
$hasLogo = file_exists(__DIR__ . '/logo.png');
// Chemin absolu du dossier courant (robuste même sans slash final dans l'URL).
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';

// Objets de visite actifs (alimentent le sélecteur). Repli silencieux si la
// table est indisponible : le champ devient une simple saisie libre.
$objets = [];
try {
  $st = db()->query('SELECT label FROM `VisitObject` WHERE isActive = 1 AND deletedAt IS NULL ORDER BY label ASC');
  $objets = $st->fetchAll(PDO::FETCH_COLUMN);
} catch (Throwable $e) {
  $objets = [];
}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>Enregistrement des visiteurs</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f1f5f9; color: #0f172a; }
  .wrap { max-width: 460px; margin: 0 auto; padding: 24px 16px; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,.08); padding: 24px; }
  .logo { display: block; max-height: 72px; max-width: 80%; margin: 0 auto 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { margin: 0 0 16px; color: #64748b; font-size: 14px; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 12px 0 4px; }
  input, textarea { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 16px; font-family: inherit; }
  .req { color: #dc2626; }
  .hp { position: absolute; left: -9999px; }
  button { width: 100%; padding: 14px; border: 0; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 18px; background: #dc2626; color: #fff; }
  .msg { margin-top: 16px; padding: 12px; border-radius: 10px; font-size: 14px; display: none; }
  .msg.err { background: #fef2f2; color: #b91c1c; display: block; }
  .msg.ok { background: #f0fdf4; color: #15803d; display: block; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <?php if ($hasLogo): ?><img class="logo" src="logo.png" alt="" /><?php endif; ?>
    <h1>Enregistrement des visiteurs</h1>
    <p class="sub" id="subtext">Merci de renseigner les informations ci-dessous. La date et l'heure sont enregistrées automatiquement.</p>

    <div id="form">
      <div class="grid2">
        <div><label>Nom <span class="req">*</span></label><input id="lastName" style="text-transform:uppercase" autocapitalize="characters" /></div>
        <div><label>Prénoms <span class="req">*</span></label><input id="firstName" autocapitalize="words" /></div>
      </div>
      <label>Entreprise</label><input id="company" />
      <div class="grid2">
        <div><label>Contacts <span class="req">*</span></label><input id="phone" inputmode="tel" /></div>
        <div><label>Adresse mail</label><input id="email" type="email" autocapitalize="none" /></div>
      </div>
      <label>Objet de visite <span class="req">*</span></label>
      <?php if (!empty($objets)): ?>
        <input id="objet" list="objets-list" placeholder="Choisir ou rechercher…" autocomplete="off" />
        <datalist id="objets-list">
          <?php foreach ($objets as $o): ?>
            <option value="<?php echo htmlspecialchars($o, ENT_QUOTES); ?>"></option>
          <?php endforeach; ?>
        </datalist>
      <?php else: ?>
        <input id="objet" />
      <?php endif; ?>
      <label>Détails</label><textarea id="details" rows="3"></textarea>
      <input class="hp" id="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <button onclick="submitForm()">Valider</button>
      <div id="msg" class="msg"></div>
    </div>
  </div>
</div>
<script>
  var API_BASE = <?php echo json_encode($base); ?>;
  function val(id){ return document.getElementById(id).value.trim(); }
  function show(cls, text){ var e=document.getElementById('msg'); e.className='msg '+cls; e.textContent=text; }
  async function submitForm(){
    show('', '');
    var payload = {
      firstName: val('firstName'), lastName: val('lastName').toUpperCase(), company: val('company'),
      phone: val('phone'), email: val('email'), objet: val('objet'), details: val('details'),
      website: document.getElementById('website').value
    };
    if(!payload.firstName || !payload.lastName || !payload.objet || !payload.phone){
      show('err','Nom, prénoms, contacts et objet de visite sont obligatoires.'); return;
    }
    try{
      var r=await fetch(API_BASE+'api.php?action=submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      var d=await r.json();
      if(!d.ok){ show('err', d.error||'Échec de l\'enregistrement.'); return; }
      document.getElementById('subtext').style.display='none';
      document.getElementById('form').innerHTML='<div class="msg ok">'+(d.message||'Visite enregistrée. Merci !')+'</div>';
    }catch(e){ show('err','Serveur injoignable.'); }
  }
</script>
</body>
</html>
