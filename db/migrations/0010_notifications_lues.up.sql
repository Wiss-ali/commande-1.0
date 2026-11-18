-- Notifications lues une par une : ouvrir une notification la marque comme lue pour cette personne
-- (en plus du bouton « Tout marquer comme vu », qui garde la table notifications_vues).
CREATE TABLE notifications_lues (
  commercant_id uuid NOT NULL REFERENCES commercants (id),
  utilisateur_id uuid NOT NULL,
  notification_id uuid NOT NULL REFERENCES notifications (id),
  lu_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (utilisateur_id, notification_id),
  FOREIGN KEY (utilisateur_id, commercant_id) REFERENCES utilisateurs (id, commercant_id)
);
ALTER TABLE notifications_lues ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_lues FORCE ROW LEVEL SECURITY;
CREATE POLICY isolation ON notifications_lues TO hanout_app USING (commercant_id = app_commercant()) WITH CHECK (commercant_id = app_commercant());
GRANT SELECT, INSERT ON notifications_lues TO hanout_app;
