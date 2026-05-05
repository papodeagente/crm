-- 0027: pipeline_stages.coolingMinutes — permite "esfriar" em minutos/horas além de dias.
-- Quando coolingMinutes IS NOT NULL, é a fonte da verdade. Quando NULL, usa coolingDays * 1440.
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS "coolingMinutes" INTEGER;
