<?php
/**
 * Page de pointage du personnel (autonome).
 * Sert le formulaire de connexion puis le choix arrivée / départ.
 * Les actions sont envoyées en AJAX à api.php (session par cookie).
 */
$hasLogo = file_exists(__DIR__ . '/logo.png');
// Chemin absolu du dossier courant (robuste même sans slash final dans l'URL),
// pour que les appels AJAX visent toujours le bon api.php.
$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';
?>
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<title>Pointage du personnel</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f1f5f9; color: #0f172a; }
  .wrap { max-width: 420px; margin: 0 auto; padding: 24px 16px; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,.08); padding: 24px; }
  .logo { display: block; max-height: 72px; max-width: 80%; margin: 0 auto 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { margin: 0 0 20px; color: #64748b; font-size: 14px; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 12px 0 4px; }
  input { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 16px; }
  button { width: 100%; padding: 14px; border: 0; border-radius: 10px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 16px; }
  .primary { background: #dc2626; color: #fff; }
  .arr { background: #16a34a; color: #fff; }
  .dep { background: #ea580c; color: #fff; }
  .msg { margin-top: 16px; padding: 12px; border-radius: 10px; font-size: 14px; display: none; white-space: pre-line; }
  .msg.err { background: #fef2f2; color: #b91c1c; display: block; }
  .msg.ok { background: #f0fdf4; color: #15803d; display: block; }
  .msg.warn { background: #fffbeb; color: #b45309; display: block; }
  .hidden { display: none; }
  .greet { font-weight: 600; margin-bottom: 4px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <?php if ($hasLogo): ?><img class="logo" src="logo.png" alt="" /><?php endif; ?>
    <h1>Pointage du personnel</h1>
    <p class="sub">Connectez-vous pour enregistrer votre pointage.</p>

    <div id="login">
      <label for="identifier">Login ou email</label>
      <input id="identifier" autocomplete="username" autocapitalize="none" />
      <label for="password">Mot de passe</label>
      <input id="password" type="password" autocomplete="current-password" />
      <button class="primary" onclick="doLogin()">Se connecter</button>
      <div id="loginMsg" class="msg"></div>
    </div>

    <div id="choice" class="hidden">
      <p class="greet" id="greet"></p>
      <button class="arr" onclick="mark('arrival')">Pointer mon arrivée</button>
      <button class="dep" onclick="mark('departure')">Pointer mon départ</button>
      <button class="primary" style="background:#64748b" onclick="reset_()">Changer de compte</button>
      <div id="markMsg" class="msg"></div>
    </div>
  </div>
</div>
<script>
  var API_BASE = <?php echo json_encode($base); ?>;
  function show(id, cls, text){ var e=document.getElementById(id); e.className='msg '+cls; e.textContent=text; }
  function hide(id){ var e=document.getElementById(id); e.className='msg'; e.textContent=''; }
  async function doLogin(){
    hide('loginMsg');
    var identifier=document.getElementById('identifier').value.trim();
    var password=document.getElementById('password').value;
    if(!identifier||!password){ show('loginMsg','err','Veuillez renseigner vos identifiants.'); return; }
    try{
      var r=await fetch(API_BASE+'api.php?action=login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:identifier,password:password})});
      var d=await r.json();
      if(!d.ok){ show('loginMsg','err',d.error||'Échec de connexion.'); return; }
      document.getElementById('greet').textContent='Bonjour '+d.employeeName;
      document.getElementById('login').classList.add('hidden');
      document.getElementById('choice').classList.remove('hidden');
    }catch(e){ show('loginMsg','err','Serveur injoignable.'); }
  }
  async function mark(type){
    hide('markMsg');
    try{
      var r=await fetch(API_BASE+'api.php?action=mark',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type})});
      var d=await r.json();
      if(!d.ok){ show('markMsg','err',d.error||'Échec du pointage.'); return; }
      show('markMsg', d.warning?'warn':'ok', d.message+(d.warning?('\n'+d.warning):''));
    }catch(e){ show('markMsg','err','Serveur injoignable.'); }
  }
  function reset_(){
    document.getElementById('password').value='';
    document.getElementById('choice').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
    hide('markMsg'); hide('loginMsg');
  }
</script>
</body>
</html>
