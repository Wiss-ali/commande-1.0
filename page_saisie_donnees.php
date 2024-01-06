<?php
session_start();
if (!isset($_SESSION["username"])) {
    header("Location: connexion.php");
    exit();
}

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Connexion à la base de données
$serveur = "127.0.0.1:3306"; // Assurez-vous que l'adresse du serveur est correcte
$nom_utilisateur = "u559440517_wissem";
$mot_de_passe = "Wisshafa69-";
$nom_base_de_donnees = "u559440517_wedevcommandes";
$mysqli = new mysqli($serveur, $nom_utilisateur, $mot_de_passe, $nom_base_de_donnees);

if ($mysqli->connect_error) {
    die("Erreur de connexion à la base de données: " . $mysqli->connect_error);
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Récupération des données du formulaire
    $nomClient = $_POST['nom'] ?? null; // Utiliser l'opérateur de coalescence nulle
    $prenomClient = $_POST['prenom'] ?? null;
    $dateDemande = $_POST['date_demande'] ?? null;
    $demandeClient = $_POST['demande'] ?? null;
    $dateLivraison = $_POST['date_livraison'] ?? null;

    // Préparation de la requête pour insérer les données
    $query = "INSERT INTO projets (nom, prenom, date_demande, demande, date_livraison) VALUES (?, ?, ?, ?, ?)";
    $stmt = $mysqli->prepare($query);

    if ($stmt) {
        // Lier les variables à la requête préparée comme paramètres
        $stmt->bind_param("sssss", $nomClient, $prenomClient, $dateDemande, $demandeClient, $dateLivraison);

        // Exécuter la requête
        if ($stmt->execute()) {
            echo "Nouveau projet enregistré avec succès.";
        } else {
            echo "Erreur: " . $stmt->error;
        }

        // Fermer la déclaration
        $stmt->close();
    } else {
        echo "Erreur: " . $mysqli->error;
    }
}

// Fermer la connexion
$mysqli->close();
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Saisie des Données</title>
</head>
<body>

<h2>Saisie des Données</h2>

<form method="post" action="page_saisie_donnees.php">
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
