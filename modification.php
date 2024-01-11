<?php
session_start();

// Vérifiez si l'utilisateur est connecté
if (!isset($_SESSION["nom_utilisateur"])) {
    header("Location: connexion.php");
    exit();
}

// Activation du rapport d'erreurs
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Informations de connexion à la base de données
$serveur = "127.0.0.1:3306";
$nom_utilisateur = "u559440517_wissem";
$mot_de_passe = "Wisshafa69-";
$nom_base_de_donnees = "u559440517_wedevcommandes";

$mysqli = new mysqli($serveur, $nom_utilisateur, $mot_de_passe, $nom_base_de_donnees);
if ($mysqli->connect_error) {
    die("Erreur de connexion à la base de données: " . $mysqli->connect_error);
}

// Vérifiez si l'ID du projet est fourni
if (!isset($_GET['id_projet']) || empty($_GET['id_projet'])) {
    echo "ID du projet manquant.";
    exit;
}

$id_projet = $_GET['id_projet'];

// Récupérez les informations du projet
$query = $mysqli->prepare("SELECT * FROM projets WHERE id = ?");
$query->bind_param("i", $id_projet);
$query->execute();
$result = $query->get_result();

if ($result->num_rows == 0) {
    echo "Projet non trouvé.";
    exit;
}

$projet = $result->fetch_assoc();

// Vérifier si le bouton 'Annuler' a été cliqué
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    if (isset($_POST['annuler'])) {
        header("Location: page_accueil.php");
        exit;
    }
}


// Traiter la soumission du formulaire de modification
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Récupérer les données du formulaire
    $nom = $_POST['nom'];
    $prenom = $_POST['prenom'];
    $demande = $_POST['demande'];
    $date_livraison = $_POST['date_livraison'];

    // Mise à jour des informations du projet
    $update = $mysqli->prepare("UPDATE projets SET nom = ?, prenom = ?, demande = ?, date_livraison = ? WHERE id = ?");
    $update->bind_param("ssssi", $nom, $prenom, $demande, $date_livraison, $id_projet); // Associez les bons types et valeurs
    $update->execute();

    if ($update->affected_rows > 0) {
        echo "<script>if(confirm('Projet mis à jour avec succès. Cliquez sur OK pour continuer.')) { window.location = 'page_accueil.php'; } else { window.location = 'page_accueil.php'; }</script>";
        header("Location: page_accueil.php");
    } else {
        header("Location: page_accueil.php");
        exit;
    }

    $update->close();
}

$mysqli->close();
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Modifier Projet</title>
    <link rel="stylesheet" href="modification.css">
</head>
<body>
<header>
    <div class="med2">
     <h1>COMMANDES</h1>

     <img src="logo.wiss.png" class="logo" alt="mon logo">
     
     <ul>
        <li><a href="page_accueil.php">Accueil</a></li>
        <li><a href="page_saisie_donnees.php">Nouvelle demande</a></li>
        <li><a href="#" onclick="confirmerDeconnexion()">déconnexion</a></li>
     </ul>
    </div>

    <div class="med1">
        <a href="page_saisie_donnees.php" class="icomob" ><img src="ajouter.png" alt="icone ajouer fichier" class="modif"></a>
        <a href="page_accueil.php"><img src="logo.wiss.png" class="logo" alt="mon logo"></a>
        <a a class="icomob" href="#" onclick="confirmerDeconnexion()"><img src="deconnecter.png" class="modif" alt="icone de deconnexion"></a>
    </div>
</header>

<h2>Modifier le Projet ID: <?php echo htmlspecialchars($id_projet); ?></h2>

<form method="post">
    <label for="nom">Nom du Projet:</label>
    <input type="text" id="nom" name="nom" value="<?php echo htmlspecialchars($projet['nom']); ?>">

    <label for="prenom">Prénom du Client:</label>
    <input type="text" id="prenom" name="prenom" value="<?php echo htmlspecialchars($projet['prenom']); ?>">

    <label for="demande">Demande du Client:</label>
    <textarea id="demande" name="demande" rows="4" cols="50"><?php echo htmlspecialchars($projet['demande']); ?></textarea>

    <label for="date_livraison">Date de Livraison Prévue:</label>
    <input type="date" id="date_livraison" name="date_livraison" value="<?php echo htmlspecialchars($projet['date_livraison']); ?>">

    <button type="submit">Mettre à jour</button>
    <button type="submit" name="annuler" class="btn-annuler">Annuler</button>


</form>

</body>
</html>
