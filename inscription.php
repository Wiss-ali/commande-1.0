<?php
session_start();
if (isset($_SESSION["username"])) {
    header("Location: page_accueil.php");
    exit();
}

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Récupérez les données du formulaire
    $nom_utilisateur = $_POST["nom_utilisateur"];
    $mot_de_passe = $_POST["mot_de_passe"];
    $nom = $_POST["nom"];
    $prenom = $_POST["prenom"];
    $email = $_POST["email"];

    // Validez et traitez les données (par exemple, vérifiez la validité de l'e-mail, hachez le mot de passe, etc.)

    // Connexion à la base de données
    $serveur = "127.0.0.1:3306";
    $nom_utilisateur = "u559440517__wiss";
    $mot_de_passe = "Themigi69-";
    $nom_base_de_donnees = "u559440517_wissem";

    $mysqli = new mysqli($serveur, $nom_utilisateur_db, $mot_de_passe_db, $nom_base_de_donnees);

    if ($mysqli->connect_error) {
        die("Erreur de connexion à la base de données: " . $mysqli->connect_error);
    }

    // Insérez les données de l'utilisateur dans la table des utilisateurs
    $requete = "INSERT INTO utilisateurs (nom_utilisateur, mot_de_passe, nom, prenom, email) VALUES (?, ?, ?, ?, ?)";
    $statement = $mysqli->prepare($requete);
    
    if ($statement) {
        $mot_de_passe_hache = password_hash($mot_de_passe, PASSWORD_DEFAULT);
        $statement->bind_param("sssss", $nom_utilisateur, $mot_de_passe_hache, $nom, $prenom, $email);
        $resultat = $statement->execute();

        if ($resultat) {
            // Redirigez l'utilisateur vers la page de connexion après une inscription réussie
            header("Location: connexion.php");
            exit();
        } else {
            echo "Erreur lors de l'inscription: " . $statement->error;
        }

        $statement->close();
    } else {
        echo "Erreur de préparation de la requête: " . $mysqli->error;
    }

    $mysqli->close();
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inscription</title>
</head>
<body>

<h2>Inscription</h2>

<form method="post" action="inscription.php">
    <label for="nom_utilisateur">Nom d'Utilisateur:</label>
    <input type="text" id="nom_utilisateur" name="nom_utilisateur" required><br>

    <label for="mot_de_passe">Mot de Passe:</label>
    <input type="password" id="mot_de_passe" name="mot_de_passe" required><br>

    <label for="nom">Nom:</label>
    <input type="text" id="nom" name="nom" required><br>

    <label for="prenom">Prénom:</label>
    <input type="text" id="prenom" name="prenom" required><br>

    <label for="email">Adresse E-mail:</label>
    <input type="email" id="email" name="email" required><br>

    <button type="submit">S'Inscrire</button>
</form>

</body>
</html>
