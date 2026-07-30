import test from "node:test";
import assert from "node:assert/strict";
import { formatExerciseName, titleCaseExerciseName } from "../lib/exercise-name";

test("elk woord krijgt een hoofdletter", () => {
  assert.equal(formatExerciseName("dumbbell incline palm-in press"), "Dumbbell Incline Palm-In Press");
  assert.equal(formatExerciseName("3/4 sit-up"), "3/4 Sit-Up");
  assert.equal(
    formatExerciseName("dumbbell one arm triceps extension (on bench)"),
    "Dumbbell One Arm Triceps Extension (On Bench)"
  );
  assert.equal(formatExerciseName("barbell rear lunge v. 2"), "Barbell Rear Lunge V. 2");
  // Ook verbindingswoorden: álle woorden een hoofdletter.
  assert.equal(
    formatExerciseName("cable lat pulldown full range of motion"),
    "Cable Lat Pulldown Full Range Of Motion"
  );
});

test("lever wordt Machine, maar alléén als eerste woord", () => {
  assert.equal(formatExerciseName("lever calf press"), "Machine Calf Press");
  assert.equal(formatExerciseName("lever reverse t-bar row"), "Machine Reverse T-Bar Row");
  // Calisthenics — geen apparaat.
  assert.equal(formatExerciseName("back lever"), "Back Lever");
  assert.equal(formatExerciseName("front lever reps"), "Front Lever Reps");
});

test("afkortingen blijven in kapitalen", () => {
  assert.equal(formatExerciseName("ez barbell close-grip curl"), "EZ Barbell Close-Grip Curl");
  assert.equal(formatExerciseName("jm press"), "JM Press");
});

test("apostrof-suffix blijft klein", () => {
  assert.equal(formatExerciseName("farmer's walk"), "Farmer's Walk");
});

test("idempotent: al genormaliseerde namen blijven gelijk", () => {
  const once = formatExerciseName("lever seated squat calf raise on leg press machine");
  assert.equal(formatExerciseName(once), once);
  assert.equal(once, "Machine Seated Squat Calf Raise On Leg Press Machine");
});

test("bestaande hoofdletters worden gerespecteerd", () => {
  assert.equal(titleCaseExerciseName("Barbell McGill Curl"), "Barbell McGill Curl");
});
