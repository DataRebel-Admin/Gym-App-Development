package nl.gymrebeltraining.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

/**
 * Toestel-agendasync: schrijft de agenda-events van het lid rechtstreeks in een
 * agenda op het toestel (CalendarContract), bijvoorbeeld de Google-agenda. Android
 * synchroniseert die daarna zelf naar Google Agenda op alle apparaten. Dit is de
 * enige automatische route op een telefoon: de Google Agenda- en Outlook-apps
 * kennen geen "abonneren via URL", dus de ICS-feed is daar dood.
 *
 * Web-kant: lib/calendar-device-sync.ts (registerPlugin("CalendarSync")).
 *
 * Eigen events herkennen we aan CUSTOM_APP_PACKAGE (= onze package-name) +
 * CUSTOM_APP_URI (= de stabiele UID uit de feed). Die twee kolommen mag een
 * gewone app schrijven (geen sync-adapter nodig), dus een nieuwe sync werkt
 * bestaande items bij en ruimt verdwenen items op in plaats van te dubbelen.
 * Events van ons in een ándere agenda (eerdere koppeling) worden bij elke sync
 * mee opgeruimd. Alles best-effort: een fout wordt naar de web-laag gemeld, die
 * toont dan "niet gelukt" en probeert later opnieuw.
 *
 * Tijdstempels uit JS zijn epoch-ms (Long) — lees ze met optLong, nooit met
 * getDouble/getInt (zie de les in WorkoutNotificationsPlugin/CLAUDE.md).
 */
@CapacitorPlugin(
    name = "CalendarSync",
    permissions = {
        @Permission(
            alias = "calendar",
            strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR }
        )
    }
)
public class CalendarSyncPlugin extends Plugin {
    private static final String ALIAS = "calendar";

    private boolean granted() {
        return getPermissionState(ALIAS) == PermissionState.GRANTED;
    }

    /** Schrijfbare agenda's op het toestel (bijdragen of hoger). */
    @PluginMethod
    public void listCalendars(PluginCall call) {
        if (!granted()) {
            call.reject("permission_denied");
            return;
        }
        String[] projection = {
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL,
            CalendarContract.Calendars.IS_PRIMARY,
            CalendarContract.Calendars.CALENDAR_COLOR
        };
        JSArray out = new JSArray();
        ContentResolver resolver = getContext().getContentResolver();
        try (Cursor c = resolver.query(CalendarContract.Calendars.CONTENT_URI, projection, null, null, null)) {
            if (c != null) {
                while (c.moveToNext()) {
                    int access = c.isNull(3) ? 0 : c.getInt(3);
                    if (access < CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR) continue;
                    JSObject cal = new JSObject();
                    cal.put("id", String.valueOf(c.getLong(0)));
                    cal.put("name", c.isNull(1) ? "" : c.getString(1));
                    cal.put("account", c.isNull(2) ? "" : c.getString(2));
                    cal.put("primary", !c.isNull(4) && c.getInt(4) == 1);
                    if (c.isNull(5)) {
                        cal.put("color", JSONObject.NULL);
                    } else {
                        cal.put("color", String.format(Locale.ROOT, "#%06X", 0xFFFFFF & c.getInt(5)));
                    }
                    out.put(cal);
                }
            }
        } catch (SecurityException e) {
            call.reject("permission_denied", e);
            return;
        }
        JSObject result = new JSObject();
        result.put("calendars", out);
        call.resolve(result);
    }

    /**
     * Volledige sync naar één agenda: upsert op UID, verwijder wat niet meer
     * in de lijst staat, ruim eigen events in andere agenda's op.
     */
    @PluginMethod
    public void sync(PluginCall call) {
        if (!granted()) {
            call.reject("permission_denied");
            return;
        }
        String calendarIdRaw = call.getString("calendarId");
        JSArray events = call.getArray("events");
        if (calendarIdRaw == null || events == null) {
            call.reject("bad_request");
            return;
        }
        long calendarId;
        try {
            calendarId = Long.parseLong(calendarIdRaw);
        } catch (NumberFormatException e) {
            call.reject("bad_request");
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        String pkg = getContext().getPackageName();
        String tz = TimeZone.getDefault().getID();

        Map<String, Long> existing = new HashMap<>();
        List<Long> stray = new ArrayList<>();
        int inserted = 0;
        int updated = 0;
        int deleted = 0;
        try {
            loadOwnEvents(resolver, pkg, calendarId, existing, stray);

            Set<String> seen = new HashSet<>();
            for (int i = 0; i < events.length(); i++) {
                JSONObject ev = events.getJSONObject(i);
                String uid = ev.optString("uid", "");
                if (uid.isEmpty() || seen.contains(uid)) continue;
                seen.add(uid);

                boolean allDay = ev.optBoolean("allDay", false);
                ContentValues v = new ContentValues();
                v.put(CalendarContract.Events.TITLE, ev.optString("title", ""));
                v.put(CalendarContract.Events.EVENT_LOCATION, ev.optString("location", ""));
                v.put(CalendarContract.Events.DTSTART, ev.optLong("startMs"));
                v.put(CalendarContract.Events.DTEND, ev.optLong("endMs"));
                v.put(CalendarContract.Events.ALL_DAY, allDay ? 1 : 0);
                // Hele-dag-events horen in UTC (CalendarContract-conventie).
                v.put(CalendarContract.Events.EVENT_TIMEZONE, allDay ? "UTC" : tz);
                v.put(
                    CalendarContract.Events.STATUS,
                    ev.optBoolean("tentative", false)
                        ? CalendarContract.Events.STATUS_TENTATIVE
                        : CalendarContract.Events.STATUS_CONFIRMED
                );
                v.put(CalendarContract.Events.HAS_ALARM, 0);
                v.put(CalendarContract.Events.CUSTOM_APP_PACKAGE, pkg);
                v.put(CalendarContract.Events.CUSTOM_APP_URI, uid);

                Long existingId = existing.get(uid);
                if (existingId != null) {
                    resolver.update(eventUri(existingId), v, null, null);
                    updated++;
                } else {
                    v.put(CalendarContract.Events.CALENDAR_ID, calendarId);
                    Uri created = resolver.insert(CalendarContract.Events.CONTENT_URI, v);
                    if (created != null) inserted++;
                }
            }

            for (Map.Entry<String, Long> e : existing.entrySet()) {
                if (seen.contains(e.getKey())) continue;
                deleted += resolver.delete(eventUri(e.getValue()), null, null);
            }
            for (Long id : stray) {
                deleted += resolver.delete(eventUri(id), null, null);
            }
        } catch (JSONException | SecurityException | IllegalArgumentException e) {
            call.reject("sync_failed", e);
            return;
        }

        JSObject result = new JSObject();
        result.put("inserted", inserted);
        result.put("updated", updated);
        result.put("deleted", deleted);
        call.resolve(result);
    }

    /** Loskoppelen: al onze events uit élke agenda op het toestel halen. */
    @PluginMethod
    public void unlink(PluginCall call) {
        if (!granted()) {
            call.reject("permission_denied");
            return;
        }
        ContentResolver resolver = getContext().getContentResolver();
        String pkg = getContext().getPackageName();
        int deleted = 0;
        try {
            Map<String, Long> none = new HashMap<>();
            List<Long> all = new ArrayList<>();
            // Doel-agenda -1 bestaat niet → alles belandt in `stray`.
            loadOwnEvents(resolver, pkg, -1L, none, all);
            for (Long id : all) {
                deleted += resolver.delete(eventUri(id), null, null);
            }
        } catch (SecurityException | IllegalArgumentException e) {
            call.reject("unlink_failed", e);
            return;
        }
        JSObject result = new JSObject();
        result.put("deleted", deleted);
        call.resolve(result);
    }

    private static Uri eventUri(long id) {
        return ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, id);
    }

    /**
     * Eigen events op het toestel: per UID het id in de doel-agenda, en los
     * daarvan alle ids die opgeruimd moeten worden (andere agenda, dubbele UID,
     * geen UID).
     */
    private static void loadOwnEvents(
        ContentResolver resolver,
        String pkg,
        long targetCalendarId,
        Map<String, Long> inTarget,
        List<Long> stray
    ) {
        String[] projection = {
            CalendarContract.Events._ID,
            CalendarContract.Events.CUSTOM_APP_URI,
            CalendarContract.Events.CALENDAR_ID
        };
        String selection =
            CalendarContract.Events.CUSTOM_APP_PACKAGE + " = ? AND " + CalendarContract.Events.DELETED + " = 0";
        try (Cursor c = resolver.query(
            CalendarContract.Events.CONTENT_URI, projection, selection, new String[] { pkg }, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                long id = c.getLong(0);
                String uid = c.isNull(1) ? "" : c.getString(1);
                long calId = c.isNull(2) ? -1L : c.getLong(2);
                if (calId == targetCalendarId && !uid.isEmpty() && !inTarget.containsKey(uid)) {
                    inTarget.put(uid, id);
                } else {
                    stray.add(id);
                }
            }
        }
    }
}
