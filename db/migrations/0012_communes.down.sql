-- Retire la liste importée (les commandes gardent la commune écrite en toutes lettres).
ALTER TABLE communes NO FORCE ROW LEVEL SECURITY;
DELETE FROM communes;
ALTER TABLE communes FORCE ROW LEVEL SECURITY;
