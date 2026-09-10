package nl.gymrebeltraining.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.concurrent.atomic.AtomicReference;

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
 *
 * ## Smartwatch
 *
 * Beide meldingen zijn bewust zo gebouwd dat ze op een gekoppeld horloge
 * (Wear OS, Galaxy Watch) zelfstandig bruikbaar zijn, zónder dat er een
 * watch-app bestaat:
 *  - `setLocalOnly(false)` houdt ze bridgebaar (zie de opmerking daar).
 *  - De rustmelding draagt twee knoppen die WorkoutActionReceiver volledig
 *    native afhandelt, dus zonder de telefoon te ontgrendelen.
 *  - De teksten zijn zelfdragend: de body noemt oefening en set, want op een
 *    40mm-scherm is "Rust voorbij" alleen te weinig om op te handelen.
 * De labels komen als parameter uit de web-kant: die kent de UI-taal
 * (next-intl), Java niet.
 */
@CapacitorPlugin(name = "WorkoutNotifications")
public class WorkoutNotificationsPlugin extends Plugin {

    private static final String CHANNEL_ONGOING = "gymrebel-workout-ongoing";
    private static final String CHANNEL_TIMER = "gymrebel-workout-timer";
    private static final int ID_ONGOING = 41001;
    static final int ID_TIMER = 41002;

    /** Requestcodes: elke PendingIntent een eigen code, anders overschrijven ze elkaar. */
    private static final int RC_TAP_ONGOING = 41101;
    private static final int RC_TAP_TIMER = 41102;
    private static final int RC_EXTEND = 41103;
    private static final int RC_DONE = 41104;

    /** Knopacties op de rustmelding, afgehandeld door WorkoutActionReceiver. */
    static final String ACTION_REST_EXTEND = "nl.gymrebeltraining.app.action.REST_EXTEND";
    static final String ACTION_REST_DONE = "nl.gymrebeltraining.app.action.REST_DONE";

    /** Met hoeveel seconden de knop "+30s" de rust verlengt. */
    static final int EXTEND_SECONDS = 30;

    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    static final String EXTRA_URL = "url";
    static final String EXTRA_EXTEND_LABEL = "extendLabel";
    static final String EXTRA_DONE_LABEL = "doneLabel";

    private static final String PREFS = "gymrebel-workout-notifications";
    private static final String KEY_PENDING = "pendingRestActions";

    /**
     * Statisch, want WorkoutActionReceiver moet dezelfde planning kunnen
     * vervangen en annuleren terwijl er geen plugin-instantie hoeft te bestaan
     * (de broadcast kan het proces koud opstarten).
     *
     * ATOMISCH, WANT ER SCHRIJVEN DRIE THREADS. Capacitor draait @PluginMethod
     * op een eigen achtergrondthread (Bridge: HandlerThread "CapacitorPlugins"),
     * terwijl de runnable hieronder en WorkoutActionReceiver op de main thread
     * lopen. Met een gewoon veld is er geen happens-before tussen die threads:
     * een `cancelRestDone` vanuit JS kon een net door de receiver gezette
     * planning missen, waarna `removeCallbacks` niet gebeurde en de melding
     * alsnog afging nadat het lid de timer had weggeklikt.
     */
    private static final Handler HANDLER = new Handler(Looper.getMainLooper());
    private static final AtomicReference<Runnable> PENDING_REST_DONE = new AtomicReference<>();

    /**
     * De levende plugin-instantie, of null als de WebView niet draait. Alleen
     * gebruikt om een "er staat iets in de wachtrij"-seintje af te vuren; de
     * wachtrij zelf blijft de bron van waarheid (zie recordAction).
     */
    private static WorkoutNotificationsPlugin instance;

    @Override
    public void load() {
        instance = this;
        createChannels();
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        super.handleOnDestroy();
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

    private static boolean canNotify(Context context) {
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    /**
     * Tik-intent: een https-URL naar de eigen MainActivity (singleTask). De
     * Capacitor-bridge vuurt daarop `appUrlOpen`, dat de bestaande
     * deep-link-handler naar het pad binnen de app laat navigeren.
     */
    private static PendingIntent tapIntent(Context context, String url, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(url));
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---------------------------------------------------------------- ongoing

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
        if (!canNotify(getContext()) || startedAtMs <= 0 || url == null || url.isEmpty()) {
            call.resolve();
            return;
        }

        Notification notification = new NotificationCompat.Builder(getContext(), CHANNEL_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_gymrebel)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(tapIntent(getContext(), url, RC_TAP_ONGOING))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            // Chronometer: het systeem laat de verstreken tijd zelf meelopen —
            // geen wakker houden van de WebView nodig. Op een gekoppeld horloge
            // loopt diezelfde teller mee, dus je ziet je trainingsduur op je pols.
            .setWhen(startedAtMs)
            .setShowWhen(true)
            .setUsesChronometer(true)
            // Wear OS gebruikt deze categorie om een lopende training als
            // activiteit te herkennen in plaats van als losse melding.
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            // Expliciet, want dit is precies de eigenschap die de melding naar
            // een gekoppeld horloge laat doorstromen. Het is de standaardwaarde,
            // maar hem hier laten staan voorkomt dat een latere wijziging de
            // smartwatch-ondersteuning stil uitzet.
            .setLocalOnly(false)
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

    // -------------------------------------------------------------- rusttimer

    /**
     * Bouwt en toont de "rust voorbij"-melding. Statisch, zodat
     * WorkoutActionReceiver na een verlenging exact dezelfde melding kan
     * plaatsen zonder plugin-instantie.
     */
    static void postRestDone(
        Context context, String title, String body, String url,
        String extendLabel, String doneLabel
    ) {
        if (!canNotify(context)) return;

        NotificationCompat.Builder builder =
            new NotificationCompat.Builder(context, CHANNEL_TIMER)
                .setSmallIcon(R.drawable.ic_stat_gymrebel)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(tapIntent(context, url, RC_TAP_TIMER))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                // ALARM mag door Niet storen en Bedtime heen. Een rusttimer die
                // je in de sportschool niet hoort is geen rusttimer.
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                // Zie de opmerking bij showOngoing: bewust expliciet.
                .setLocalOnly(false);

        // De knoppen. Alleen toevoegen als de web-kant een label meestuurde —
        // een knop zonder tekst is op een horloge een blinde tik.
        if (extendLabel != null && !extendLabel.isEmpty()) {
            builder.addAction(action(
                context, ACTION_REST_EXTEND, RC_EXTEND, extendLabel,
                title, body, url, extendLabel, doneLabel));
        }
        if (doneLabel != null && !doneLabel.isEmpty()) {
            builder.addAction(action(
                context, ACTION_REST_DONE, RC_DONE, doneLabel,
                title, body, url, extendLabel, doneLabel));
        }

        NotificationManagerCompat.from(context).notify(ID_TIMER, builder.build());
    }

    /**
     * Een knop die naar WorkoutActionReceiver broadcast. De extra's reizen mee
     * zodat de receiver na een verlenging dezelfde melding opnieuw kan opbouwen,
     * ook als het proces intussen koud is opgestart.
     */
    private static NotificationCompat.Action action(
        Context context, String intentAction, int requestCode, String label,
        String title, String body, String url, String extendLabel, String doneLabel
    ) {
        Intent intent = new Intent(context, WorkoutActionReceiver.class);
        intent.setAction(intentAction);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_BODY, body);
        intent.putExtra(EXTRA_URL, url);
        intent.putExtra(EXTRA_EXTEND_LABEL, extendLabel);
        intent.putExtra(EXTRA_DONE_LABEL, doneLabel);
        PendingIntent pending = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Action.Builder(R.drawable.ic_stat_gymrebel, label, pending)
            // Cruciaal voor de smartwatch: zonder deze vlag gaan Wear OS en
            // Android Auto ervan uit dat de knop een scherm opent en bieden ze
            // hem aan als "open op je telefoon". Met false handelen ze hem ter
            // plekke af, wat het hele punt is van een knop op je pols.
            .setShowsUserInterface(false)
            .build();
    }

    /** Plan de "rust voorbij"-melding vooruit; vervangt een eerdere planning. */
    static void scheduleRestDone(
        Context context, long inMs, String title, String body, String url,
        String extendLabel, String doneLabel
    ) {
        cancelScheduledRestDone();
        if (inMs <= 0 || url == null || url.isEmpty()) return;

        final Context app = context.getApplicationContext();
        final String fTitle = title;
        final String fBody = body;
        final String fUrl = url;
        final String fExtend = extendLabel;
        final String fDone = doneLabel;
        Runnable task = new Runnable() {
            @Override
            public void run() {
                // Alleen tonen als dit nog de actuele planning is. Vangt ook de
                // race waarin removeCallbacks net te laat komt doordat deze
                // runnable al uit de queue was gehaald om te draaien.
                if (!PENDING_REST_DONE.compareAndSet(this, null)) return;
                postRestDone(app, fTitle, fBody, fUrl, fExtend, fDone);
            }
        };
        PENDING_REST_DONE.set(task);
        HANDLER.postDelayed(task, inMs);
    }

    static void cancelScheduledRestDone() {
        Runnable previous = PENDING_REST_DONE.getAndSet(null);
        if (previous != null) HANDLER.removeCallbacks(previous);
    }

    @PluginMethod
    public void scheduleRestDone(PluginCall call) {
        Integer inMs = call.getInt("inMs");
        String title = call.getString("title", "Rust voorbij");
        String body = call.getString("body", "");
        String url = call.getString("url", "");
        String extendLabel = call.getString("extendLabel", "");
        String doneLabel = call.getString("doneLabel", "");
        if (inMs == null) {
            cancelScheduledRestDone();
            call.resolve();
            return;
        }
        scheduleRestDone(getContext(), inMs.longValue(), title, body, url, extendLabel, doneLabel);
        call.resolve();
    }

    @PluginMethod
    public void cancelRestDone(PluginCall call) {
        cancelScheduledRestDone();
        // Ook een al getoonde timer-melding opruimen: de gebruiker is terug in
        // de app en is de rust voorbij — de melding heeft z'n werk gedaan.
        NotificationManagerCompat.from(getContext()).cancel(ID_TIMER);
        call.resolve();
    }

    // --------------------------------------------------------- actie-wachtrij

    /**
     * Legt een op de melding (of op een horloge) getikte knop vast en seint de
     * WebView in als die draait.
     *
     * De wachtrij in SharedPreferences is de enige bron van waarheid; het event
     * draagt bewust géén gegevens en betekent alleen "er staat iets klaar".
     * Zou het event de actie zelf meedragen, dan zou een actie die het event
     * oppikt én daarna alsnog de wachtrij consumeert twee keer worden toegepast.
     */
    static void recordAction(Context context, String type, int seconds) {
        SharedPreferences prefs = context.getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray queue = readQueue(prefs);
        try {
            JSONObject item = new JSONObject();
            item.put("type", type);
            item.put("seconds", seconds);
            // Het tijdstip van de tik, zodat de web-kant bij het toepassen kan
            // corrigeren voor de tijd die verstreek voordat de app weer draaide.
            item.put("at", System.currentTimeMillis());
            queue.put(item);
        } catch (JSONException e) {
            return;
        }
        prefs.edit().putString(KEY_PENDING, queue.toString()).apply();

        WorkoutNotificationsPlugin plugin = instance;
        if (plugin != null) plugin.notifyListeners("restAction", new JSObject());
    }

    private static JSONArray readQueue(SharedPreferences prefs) {
        String raw = prefs.getString(KEY_PENDING, null);
        if (raw == null || raw.isEmpty()) return new JSONArray();
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            // Onleesbare wachtrij: weggooien is hier veiliger dan vasthouden.
            // Het gaat om een timerverlenging, niet om data die je kunt missen.
            return new JSONArray();
        }
    }

    /** Geeft de wachtende acties terug en leegt de wachtrij (eenmalig toepassen). */
    @PluginMethod
    public void consumePendingActions(PluginCall call) {
        SharedPreferences prefs = getContext().getApplicationContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray queue = readQueue(prefs);
        prefs.edit().remove(KEY_PENDING).apply();

        JSObject result = new JSObject();
        result.put("actions", queue);
        call.resolve(result);
    }
}
