<?php
session_start();
if (!isset($_SESSION["username"])) {
    header("Location: connexion.php");
    exit();
}

// Vérifiez la validité du token d'authentification

// Définissez les informations de connexion à la base de données
$serveur = "127.0.0.1:3306";
$nom_utilisateur = "u559440517__wiss";
$mot_de_passe = "Themigi69-";
$nom_base_de_donnees = "u559440517_wissem";

// Connexion à la base de données
$mysqli = new mysqli($serveur, $nom_utilisateur, $mot_de_passe, $nom_base_de_donnees);

if ($mysqli->connect_error) {
    die("Erreur de connexion à la base de données: " . $mysqli->connect_error);
}

// Récupérez le nom du projet depuis l'URL
if (isset($_GET["projet"])) {
    $nomProjet = urldecode($_GET["projet"]);
} else {
    // Redirigez vers la page d'accueil si le nom du projet n'est pas spécifié
    header("Location: page_accueil.php");
    exit();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Saisie des Données - <?php echo $nomProjet; ?></title>
</head>
<body>

<h2>Saisie des Données - <?php echo $nomProjet; ?></h2>

<!-- Formulaire de saisie des données clients comme demandé précédemment -->

<form method="post" action="traitement_saisie_donnees.php">
    <label for="nom">Nom du Client:</label>
    <input type="text" id="nom" name="nom" required><br>

    <label for="prenom">Prénom du Client:</label>
    <input type="text" id="prenom" name="prenom" required><br>

    <label for="date_demande">Date de Demande:</label>
    <input type="date" id="date_demande" name="date_demande" value="<?php echo date('Y-m-d'); ?>" required><br>

    <label for="demande">Demande du Client:</label><br>
    <textarea id="demande" name="demande" rows="4" cols="50" required></textarea><br>

    <label for="date_livraison">Date de Livraison Prévue:</label>
    <input type="date" id="date_livraison" name="date_livraison" required><br>

    <button type="submit">Enregistrer</button>
</form>

</body>
</html>
