import { ChartColumn, Calculator, FileText, Package, Store, Truck, UsersRound } from 'lucide-react';
import type { NomModule } from './types-bd';

export const ICONE_MODULE: Record<NomModule, typeof Package> = {
  stock: Package, caisse: Calculator, factures: FileText, commandes: Truck, boutique: Store, clients: UsersRound, rapports: ChartColumn,
};
