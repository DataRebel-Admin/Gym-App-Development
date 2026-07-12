-- Trainer die een trainingssessie namens het lid draaide (PT-sessie vastleggen).
-- NULL = het lid loggde zelf. Puur attributie/audit, géén FK (zoals
-- AssignedWorkout.assignedById). WorkoutSession is al tenant-scoped → geen
-- RLS-wijziging nodig.

ALTER TABLE "WorkoutSession"
  ADD COLUMN "conductedById" TEXT;
