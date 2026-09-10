package nl.gymrebeltraining.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

/**
 * Handelt de knoppen op de "rust voorbij"-melding af. Web-kant:
 * lib/workout-notifications.ts.
 *
 * ## Waarom een BroadcastReceiver en geen Activity
 *
 * Dit is de hele reden dat de meldingsknoppen op een smartwatch bruikbaar zijn.
 * Een actie die MainActivity start, opent de app op je telefoon: op een horloge
 * betekent dat "pak je telefoon", precies wat we willen voorkomen. Een broadcast
 * draait zonder scherm, dus een tik op je pols verlengt de rust terwijl de
 * telefoon in je tas blijft. De acties dragen daarom ook
 * `setShowsUserInterface(false)` (zie WorkoutNotificationsPlugin), want zonder
 * die vlag presenteren Wear OS en Android Auto ze alsnog als "open op telefoon".
 *
 * De WebView is op dat moment doorgaans geThrottled of helemaal weg, dus de
 * afhandeling gebeurt volledig native: de melding wordt opgeruimd, een verlenging
 * meteen opnieuw ingepland, en wát er gebeurde belandt in een wachtrij die de
 * web-kant uitleest zodra hij weer draait (WorkoutNotificationsPlugin.recordAction).
 * Zo loopt de timer in beeld nooit uit de pas met wat er op de pols is getikt.
 *
 * ## Bekende grens van "+30s"
 *
 * De verlenging wordt met Handler.postDelayed ingepland, dus ze komt alleen als
 * het proces die 30 seconden haalt. Heeft een tik dit proces koud opgestart, dan
 * mag Android het opruimen zodra onReceive klaar is en valt de melding weg. In de
 * praktijk traint het lid op dat moment en staat de app nog in het geheugen.
 *
 * Het alternatief is AlarmManager, en dat lost het niet beter op: exacte alarmen
 * vragen SCHEDULE_EXACT_ALARM (Play beoordeelt die permissie streng, en het
 * manifest houdt de lijst bewust minimaal), terwijl een inexact alarm tot een
 * kwartier mag schuiven en voor een rusttimer van 30 seconden dus zinloos is.
 * Zelfde best-effort-afweging als de oorspronkelijke planning in de plugin.
 */
public class WorkoutActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        String title = intent.getStringExtra(WorkoutNotificationsPlugin.EXTRA_TITLE);
        String body = intent.getStringExtra(WorkoutNotificationsPlugin.EXTRA_BODY);
        String url = intent.getStringExtra(WorkoutNotificationsPlugin.EXTRA_URL);
        String extendLabel = intent.getStringExtra(WorkoutNotificationsPlugin.EXTRA_EXTEND_LABEL);
        String doneLabel = intent.getStringExtra(WorkoutNotificationsPlugin.EXTRA_DONE_LABEL);

        if (WorkoutNotificationsPlugin.ACTION_REST_EXTEND.equals(action)) {
            // De melding heeft z'n werk gedaan; er komt een nieuwe als de
            // verlenging afloopt.
            NotificationManagerCompat.from(context).cancel(WorkoutNotificationsPlugin.ID_TIMER);
            WorkoutNotificationsPlugin.scheduleRestDone(
                context,
                WorkoutNotificationsPlugin.EXTEND_SECONDS * 1000L,
                title, body, url, extendLabel, doneLabel);
            WorkoutNotificationsPlugin.recordAction(
                context, "extend", WorkoutNotificationsPlugin.EXTEND_SECONDS);
            return;
        }

        if (WorkoutNotificationsPlugin.ACTION_REST_DONE.equals(action)) {
            NotificationManagerCompat.from(context).cancel(WorkoutNotificationsPlugin.ID_TIMER);
            WorkoutNotificationsPlugin.cancelScheduledRestDone();
            WorkoutNotificationsPlugin.recordAction(context, "done", 0);
        }
    }
}
