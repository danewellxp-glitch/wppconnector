-- Add AWAITING_COMPRAS_SUBMENU value to FlowState enum
-- Required for the compras department sub-routing flow
ALTER TYPE "FlowState" ADD VALUE IF NOT EXISTS 'AWAITING_COMPRAS_SUBMENU';
