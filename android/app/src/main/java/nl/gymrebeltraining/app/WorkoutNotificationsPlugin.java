package nl.gymrebeltraining.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

/**
 * Lokale meldingen rond de actieve workout. Web-kant: lib/workout-notifications.ts.
 *
 * Twee taken:
 *  1. Een blijvende (ongoing) "training bezig"-melding met meelopende
 *     chronometer; tikken opent de actieve-trainingspagina via een gewone
 *     https-intent naar MainActivity (App Links → appUrlOpen in de WebView).
 *  2. Een vooruit ingeplande "rust voorbij"-melding: de WebView throttlet
 *     JS-timers zodra de app naar de achtergrond gaat, dus de melding wordt bij
 *     het stárten van de rusttimer gepland (Handler.postDelayed — de workout
 *     houdt het proces in de praktijk in leven; sterft het toch, dan valt er
 *     alleen een best-effort-melding weg) en geannuleerd zodra de timer in
 *     beeld afloopt, gepauzeerd of gesloten wordt.
 *
 * Eigen kanalen, los van de FCM-categoriekanalen uit lib/push-channels.ts: de
 * gebruiker moet "timer"-geluiden apart kunnen dempen van bijv. schema-meldingen.
 * Zonder POST_NOTIFICATIONS-permissie doet alles stil niets (best-effort).
 */
@CapacitorPlugin(name = "WorkoutNotifications")
public class WorkoutNotificationsPlugin extends Plugin {

    private static final String CHANNEL_ONGOING = "gymrebel-workout-ongoing";
    private static final String CHANNEL_TIMER = "gymrebel-workout-timer";
    private static final int ID_ONGOING = 41001;
    private static final int ID_TIMER = 41002;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable pendingRestDone;

    @Override
    public void load() {
        createChannels();
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getContext().getSystemService(NotificationManager.class);
        if (manager == null) return;

        // Stil kanaal: de blijvende melding mag nooit piepen of trillen.
        NotificationChannel ongoing = new NotificationChannel(
            CHANNEL_ONGOING, "Actieve training", NotificationManager.IMPORTANCE_LOW);
        ongoing.setDescription("Blijvende melding zolang er een training loopt.");
        ongoing.setShowBadge(false);
        manager.createNotificationChannel(ongoing);

        // De timer mag wél onderbreken: geluid + trilling bij het aflopen.
        NotificationChannel timer = new NotificationChannel(
            CHANNEL_TIMER, "Rusttimer", NotificationManager.IMPORTANCE_HIGH);
        timer.setDescription("Melding wanneer de rusttimer is afgelopen.");
        timer.enableVibration(true);
        timer.setVibrationPattern(new long[] { 0, 180, 90, 180 });
        manager.createNotificationChannel(timer);
    }

    private boolean canNotify() {
        return NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    /**
     * Tik-intent: een https-URL naar de eigen MainActivity (singleTask). De
     * Capacitor-bridge vuurt daarop `appUrlOpen`, dat de bestaande
     * deep-link-handler naar het pad binnen de app laat navigeren.
     */
    private PendingIntent tapIntent(String url, int requestCode) {
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(url));
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            getContext(), requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @PluginMethod
    public void showOngoing(PluginCall call) {
        String title = call.getString("title", "Training bezig");
        String text = call.getString("text", "");
        // NIET call.getDouble() gebruiken voor een epoch in ms. Die helper kent
        // alleen Double, Float en Integer; een tijdstempel (~1,76e12) valt buiten
        // Integer, komt door de JSON-laag als Long binnen en levert dus stil de
        // standaardwaarde op. Gevolg: deze methode viel altijd in de guard
        // hieronder en er verscheen nooit een melding, zonder enige fout.
        // optLong() op de ruwe JSON dekt Integer, Long én Double.
        long startedAtMs = call.getData().optLong("startedAtMs", 0L);
        String url = call.getString("url", "");
        if (!canNotify() || startedAtMs <= 0 || url == null || url.isEmpty()) {
            call.resolve();
            return;
        }

        Notification notification = new NotificationCompat.Builder(getContext(), CHANNEL_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_gymrebel)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(tapIntent(url, ID_ONGOING))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            // Chronometer: het systeem laat de verstreken tijd zelf meelopen —
            // geen wakker houden van de WebView nodig.
            .setWhen(startedAtMs)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

        NotificationManagerCompat.from(getContext()).notify(ID_ONGOING, notification);
        call.resolve();
    }

    @PluginMethod
    public void clearOngoing(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(ID_ONGOING);
        call.resolve();
    }

    @PluginMethod
    public void scheduleRestDone(PluginCall call) {
        Integer inMs = call.getInt("inMs");
        String title = call.getString("title", "Rust voorbij");
        String body = call.getString("body", "");
        String url = call.getString("url", "");
        cancelPendingRestDone();
        if (inMs == null || inMs <= 0 || url == null || url.isEmpty()) {
            call.resolve();
            return;
        }

        final Context context = getContext();
        final PendingIntent tap = tapIntent(url, ID_TIMER);
        final String fTitle = title;
        final String fBody = body;
        pendingRestDone = () -> {
            pendingRestDone = null;
            if (!canNotify()) return;
            Notification notification = new NotificationCompat.Builder(context, CHANNEL_TIMER)
                .setSmallIcon(R.drawable.ic_stat_gymrebel)
                .setContentTitle(fTitle)
                .setContentText(fBody)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .build();
            NotificationManagerCompat.from(context).notify(ID_TIMER, notification);
        };
        handler.postDelayed(pendingRestDone, inMs.longValue());
        call.resolve();
    }

    @PluginMethod
    public void cancelRestDone(PluginCall call) {
        cancelPendingRestDone();
        // Ook een al getoonde timer-melding opruimen: de gebruiker is terug in
        // de app en is de rust voorbij — de melding heeft z'n werk gedaan.
        NotificationManagerCompat.from(getContext()).cancel(ID_TIMER);
        call.resolve();
    }

    private void cancelPendingRestDone() {
        if (pendingRestDone != null) {
            handler.removeCallbacks(pendingRestDone);
            pendingRestDone = null;
        }
    }
}
